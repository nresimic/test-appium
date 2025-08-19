import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { 
  BitriseConfig, 
  BuildInfo, 
  ArtifactInfo, 
  BuildMetadata, 
  BitriseApiResponse, 
  BitriseArtifactResponse 
} from '../../types';

export class BitriseService {
  private client: AxiosInstance;
  private config: BitriseConfig;
  private metadataFile: string;

  constructor(config: Partial<BitriseConfig> = {}) {
    this.config = {
      apiToken: process.env.BITRISE_API_TOKEN || '',
      appSlug: process.env.BITRISE_APP_SLUG || '',
      baseUrl: 'https://api.bitrise.io/v0.1',
      cacheDir: path.join(process.cwd(), '.bitrise-cache'),
      appsDir: path.join(process.cwd(), 'apps'),
      ...config
    };

    this.validateConfig();

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': this.config.apiToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    this.metadataFile = path.join(this.config.cacheDir, 'build-metadata.json');
    this.ensureCacheDirectory();
  }

  private validateConfig(): void {
    if (!this.config.apiToken) {
      throw new Error('BITRISE_API_TOKEN is required');
    }
    if (!this.config.appSlug) {
      throw new Error('BITRISE_APP_SLUG is required');
    }
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.config.appsDir)) {
      fs.mkdirSync(this.config.appsDir, { recursive: true });
    }
  }

  /**
   * Get cached build metadata
   */
  private getCachedMetadata(): Record<string, BuildMetadata> {
    if (!fs.existsSync(this.metadataFile)) {
      return {};
    }
    try {
      const content = fs.readFileSync(this.metadataFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('Failed to read cache metadata, starting fresh');
      return {};
    }
  }

  /**
   * Save build metadata to cache
   */
  private saveCachedMetadata(metadata: Record<string, BuildMetadata>): void {
    fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
  }

  /**
   * Calculate file checksum for integrity verification
   */
  private calculateChecksum(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Check if we have the latest build cached
   */
  async isLatestBuildCached(branch: string = 'develop'): Promise<{ cached: boolean; buildInfo?: BuildInfo }> {
    try {
      const latestBuild = await this.getLatestSuccessfulBuild(branch);
      if (!latestBuild) {
        return { cached: false };
      }

      const metadata = this.getCachedMetadata();
      // Use simple cache key without platform suffix - platform is determined by file extension
      const cacheKey = `${branch}-${latestBuild.buildNumber}`;
      const cached = metadata[cacheKey];

      if (cached && fs.existsSync(cached.filePath)) {
        // Verify file integrity
        const currentChecksum = this.calculateChecksum(cached.filePath);
        if (currentChecksum === cached.checksum) {
          console.log(`✅ Latest build #${latestBuild.buildNumber} already cached`);
          return { cached: true, buildInfo: latestBuild };
        }
      }

      return { cached: false, buildInfo: latestBuild };
    } catch (error) {
      console.error('Error checking cache:', error);
      return { cached: false };
    }
  }

  /**
   * Get the latest successful build for a branch
   */
  async getLatestSuccessfulBuild(branch: string = 'develop'): Promise<BuildInfo | null> {
    try {
      const response = await this.client.get(`/apps/${this.config.appSlug}/builds`, {
        params: {
          branch,
          status: 1, // Success
          limit: 1,
          sort_by: 'created_at'
        }
      });

      const builds = response.data.data;
      if (!builds || builds.length === 0) {
        // Try to find builds on any branch as fallback
        const allBuildsResponse = await this.client.get(`/apps/${this.config.appSlug}/builds`, {
          params: {
            status: 1,
            limit: 5
          }
        });

        if (allBuildsResponse.data.data?.length > 0) {
          console.log('Available branches with builds:');
          const branches = new Set((allBuildsResponse.data as BitriseApiResponse).data.map(b => b.branch));
          branches.forEach(b => console.log(`  - ${b}`));
        }
        return null;
      }

      const build = builds[0];
      return {
        buildNumber: build.build_number,
        buildSlug: build.slug,
        status: build.status_text,
        branch: build.branch,
        commitHash: build.commit_hash,
        commitMessage: build.commit_message,
        triggeredAt: build.triggered_at,
        finishedAt: build.finished_at
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Authentication failed. Check your BITRISE_API_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Get available branches from Bitrise
   */
  async getAvailableBranches(): Promise<string[]> {
    try {
      const response = await this.client.get(`/apps/${this.config.appSlug}/branches`);
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch branches from Bitrise:', error);
      // Fallback to common branch names
      return ['main', 'develop', 'master'];
    }
  }

  /**
   * Get recent builds for a branch to see available build configurations
   */
  async getBuildConfigurations(branch: string, limit: number = 10): Promise<BuildInfo[]> {
    try {
      const response = await this.client.get(`/apps/${this.config.appSlug}/builds`, {
        params: {
          branch,
          status: 1, // Only successful builds
          limit,
          sort_by: 'created_at'
        }
      });

      const builds = response.data.data || [];
      return builds.map((build: any) => ({
        buildNumber: build.build_number,
        buildSlug: build.slug,
        status: build.status_text,
        branch: build.branch,
        commitHash: build.commit_hash,
        commitMessage: build.commit_message,
        triggeredAt: build.triggered_at,
        finishedAt: build.finished_at,
        workflow: build.triggered_workflow || 'default'
      }));
    } catch (error) {
      console.error('Failed to fetch build configurations:', error);
      return [];
    }
  }

  /**
   * Get build artifacts
   */
  async getBuildArtifacts(buildSlug: string): Promise<ArtifactInfo[]> {
    const response = await this.client.get(
      `/apps/${this.config.appSlug}/builds/${buildSlug}/artifacts`
    );

    return (response.data as BitriseArtifactResponse).data.map(artifact => ({
      title: artifact.title,
      slug: artifact.slug,
      artifactType: artifact.artifact_type,
      fileSizeBytes: artifact.file_size_bytes
    }));
  }

  /**
   * Download and cache a specific APK by build slug
   */
  async downloadSpecificAPK(buildSlug: string, branch: string, forceDownload: boolean = false): Promise<string | null> {
    console.log(`🔍 Downloading specific build: ${buildSlug}`);
    
    try {
      // Get build info for the specific slug first
      const buildResponse = await this.client.get(`/apps/${this.config.appSlug}/builds/${buildSlug}`);
      const buildData = buildResponse.data.data;
      
      // Check if this specific build is already cached (unless force download)
      if (!forceDownload) {
        const metadata = this.getCachedMetadata();
        const cacheKey = `${branch}-${buildData.build_number}`;
        const cached = metadata[cacheKey];
        
        if (cached && cached.buildSlug === buildSlug && fs.existsSync(cached.filePath)) {
          // Verify file integrity
          const currentChecksum = this.calculateChecksum(cached.filePath);
          if (currentChecksum === cached.checksum) {
            console.log(`✅ Build #${buildData.build_number} (${buildSlug}) already cached`);
            console.log(`📦 Using cached file: ${cached.filePath}`);
            return cached.filePath;
          } else {
            console.log(`⚠️ Cached file corrupted, re-downloading...`);
          }
        }
      }
      
      const buildInfo: BuildInfo = {
        buildNumber: buildData.build_number,
        buildSlug: buildData.slug,
        status: buildData.status_text,
        branch: buildData.branch,
        commitHash: buildData.commit_hash,
        commitMessage: buildData.commit_message,
        triggeredAt: buildData.triggered_at,
        finishedAt: buildData.finished_at,
        workflow: buildData.triggered_workflow || 'default'
      };

      console.log(`📱 Found build #${buildInfo.buildNumber} (${buildInfo.commitHash || 'no commit'})`);

      // Get artifacts
      const artifacts = await this.getBuildArtifacts(buildInfo.buildSlug);
      
      // Find APK (exclude .idsig files, prefer signed)
      const apkArtifacts = artifacts.filter(a => 
        (a.title.toLowerCase().endsWith('.apk') || a.artifactType === 'android-apk') &&
        !a.title.includes('.idsig')
      );

      const apkArtifact = apkArtifacts.find(a => a.title.includes('signed')) || apkArtifacts[0];

      if (!apkArtifact) {
        console.log('❌ No APK artifact found in build');
        return null;
      }

      console.log(`📦 Selected artifact: ${apkArtifact.title} (${(apkArtifact.fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`);

      // Get download URL
      const artifactResponse = await this.client.get(
        `/apps/${this.config.appSlug}/builds/${buildInfo.buildSlug}/artifacts/${apkArtifact.slug}`
      );

      const downloadUrl = artifactResponse.data.data.expiring_download_url;

      // Prepare file path
      const androidDir = path.join(this.config.appsDir, 'android');
      if (!fs.existsSync(androidDir)) {
        fs.mkdirSync(androidDir, { recursive: true });
      }

      const filename = `app-${branch}-build-${buildInfo.buildNumber}.apk`;
      const filePath = path.join(androidDir, filename);

      // Download file
      console.log(`💾 Downloading to: ${filePath}`);
      const downloadResponse = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            process.stdout.write(`\rDownloading: ${percentCompleted}%`);
          }
        }
      });

      const writer = fs.createWriteStream(filePath);
      downloadResponse.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      console.log('\n✅ Download complete');

      // Calculate checksum and save metadata
      const checksum = this.calculateChecksum(filePath);
      const stats = fs.statSync(filePath);
      
      const metadata = this.getCachedMetadata();
      const cacheKey = `${branch}-${buildInfo.buildNumber}`;
      
      metadata[cacheKey] = {
        buildNumber: buildInfo.buildNumber,
        buildSlug: buildInfo.buildSlug,
        branch: buildInfo.branch,
        commitHash: buildInfo.commitHash,
        downloadedAt: new Date().toISOString(),
        filePath,
        fileSize: stats.size,
        checksum
      };

      this.saveCachedMetadata(metadata);

      // Clean old APKs from the same branch (keep last 3)
      this.cleanOldBuilds(branch, 3);

      return filePath;
    } catch (error) {
      console.error('Error downloading specific build:', error);
      throw error;
    }
  }

  /**
   * Download and cache the latest APK
   */
  async downloadLatestAPK(branch: string = 'develop', forceDownload: boolean = false): Promise<string | null> {
    // Check cache first
    if (!forceDownload) {
      const cacheCheck = await this.isLatestBuildCached(branch);
      if (cacheCheck.cached && cacheCheck.buildInfo) {
        const metadata = this.getCachedMetadata();
        const cacheKey = `${branch}-${cacheCheck.buildInfo.buildNumber}`;
        console.log(`📦 Using cached APK: ${metadata[cacheKey].filePath}`);
        return metadata[cacheKey].filePath;
      }
    }

    console.log(`🔍 Fetching latest build for branch: ${branch}`);
    const latestBuild = await this.getLatestSuccessfulBuild(branch);
    
    if (!latestBuild) {
      console.log(`❌ No successful builds found for branch: ${branch}`);
      return null;
    }

    console.log(`📱 Found build #${latestBuild.buildNumber} (${latestBuild.commitHash || 'no commit'})`);

    // Get artifacts
    const artifacts = await this.getBuildArtifacts(latestBuild.buildSlug);
    
    // Find APK (exclude .idsig files, prefer signed)
    const apkArtifacts = artifacts.filter(a => 
      (a.title.toLowerCase().endsWith('.apk') || a.artifactType === 'android-apk') &&
      !a.title.includes('.idsig')
    );

    const apkArtifact = apkArtifacts.find(a => a.title.includes('signed')) || apkArtifacts[0];

    if (!apkArtifact) {
      console.log('❌ No APK artifact found in build');
      return null;
    }

    console.log(`📦 Selected artifact: ${apkArtifact.title} (${(apkArtifact.fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`);

    // Get download URL
    const artifactResponse = await this.client.get(
      `/apps/${this.config.appSlug}/builds/${latestBuild.buildSlug}/artifacts/${apkArtifact.slug}`
    );

    const downloadUrl = artifactResponse.data.data.expiring_download_url;

    // Prepare file path
    const androidDir = path.join(this.config.appsDir, 'android');
    if (!fs.existsSync(androidDir)) {
      fs.mkdirSync(androidDir, { recursive: true });
    }

    const filename = `app-${branch}-build-${latestBuild.buildNumber}.apk`;
    const filePath = path.join(androidDir, filename);

    // Download file
    console.log(`💾 Downloading to: ${filePath}`);
    const downloadResponse = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          process.stdout.write(`\rDownloading: ${percentCompleted}%`);
        }
      }
    });

    const writer = fs.createWriteStream(filePath);
    downloadResponse.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });

    console.log('\n✅ Download complete');

    // Calculate checksum and save metadata
    const checksum = this.calculateChecksum(filePath);
    const stats = fs.statSync(filePath);
    
    const metadata = this.getCachedMetadata();
    const cacheKey = `${branch}-${latestBuild.buildNumber}`;
    
    metadata[cacheKey] = {
      buildNumber: latestBuild.buildNumber,
      buildSlug: latestBuild.buildSlug,
      branch: latestBuild.branch,
      commitHash: latestBuild.commitHash,
      downloadedAt: new Date().toISOString(),
      filePath,
      fileSize: stats.size,
      checksum
    };

    this.saveCachedMetadata(metadata);

    // Clean old APKs from the same branch (keep last 3)
    this.cleanOldBuilds(branch, 3);

    return filePath;
  }

  /**
   * Clean old builds, keeping only the specified number of recent builds
   */
  private cleanOldBuilds(branch: string, keepCount: number = 3): void {
    const metadata = this.getCachedMetadata();
    
    // Filter builds for the specific branch, then separate existing vs missing files
    const branchBuilds = Object.entries(metadata)
      .filter(([key]) => key.startsWith(`${branch}-`));
    
    const existingBuilds = branchBuilds.filter(([, build]) => fs.existsSync(build.filePath));
    const missingBuilds = branchBuilds.filter(([, build]) => !fs.existsSync(build.filePath));
    
    // Clean up metadata for missing files first
    if (missingBuilds.length > 0) {
      console.log(`🧹 Cleaning metadata for ${missingBuilds.length} missing files:`);
      missingBuilds.forEach(([key, build]) => {
        console.log(`  Removing metadata: ${path.basename(build.filePath)} (build #${build.buildNumber}) - file not found`);
        delete metadata[key];
      });
    }
    
    // Sort existing builds by build number (descending - newest first)
    const sortedExistingBuilds = existingBuilds.sort((a, b) => {
      return b[1].buildNumber - a[1].buildNumber;
    });
    
    if (sortedExistingBuilds.length > keepCount) {
      console.log(`🧹 Cleaning old builds (keeping last ${keepCount} existing files)`);
      console.log(`📊 Found ${sortedExistingBuilds.length} existing builds for branch '${branch}', keeping newest ${keepCount}`);
      
      // Keep the first 'keepCount' builds (newest), delete the rest (oldest)
      const buildsToDelete = sortedExistingBuilds.slice(keepCount);
      const buildsToKeep = sortedExistingBuilds.slice(0, keepCount);
      
      console.log(`📥 Keeping builds: ${buildsToKeep.map(([, b]) => `#${b.buildNumber}`).join(', ')}`);
      console.log(`🗑️ Deleting builds: ${buildsToDelete.map(([, b]) => `#${b.buildNumber}`).join(', ')}`);
      
      buildsToDelete.forEach(([key, build]) => {
        // Delete file (we know it exists since we filtered for existing files)
        fs.unlinkSync(build.filePath);
        console.log(`  Deleted: ${path.basename(build.filePath)} (build #${build.buildNumber})`);
        
        // Remove from metadata
        delete metadata[key];
      });
    } else {
      console.log(`📁 Found ${sortedExistingBuilds.length} existing builds for branch '${branch}' (within limit of ${keepCount})`);
    }
    
    // Save updated metadata (includes removal of missing file entries)
    this.saveCachedMetadata(metadata);
  }

  /**
   * Get the currently cached build path for a branch (APK or IPA)
   */
  getCachedBuildPath(branch: string = 'develop', platform: 'android' | 'ios' = 'android'): string | null {
    const metadata = this.getCachedMetadata();
    const branchBuilds = Object.entries(metadata)
      .filter(([key]) => key.startsWith(`${branch}-`))
      .sort((a, b) => b[1].buildNumber - a[1].buildNumber);

    // Find the most recent build for the specified platform
    for (const [key, build] of branchBuilds) {
      if (fs.existsSync(build.filePath)) {
        const isAndroid = build.filePath.toLowerCase().endsWith('.apk');
        const isIOS = build.filePath.toLowerCase().endsWith('.ipa');
        
        if ((platform === 'android' && isAndroid) || (platform === 'ios' && isIOS)) {
          return build.filePath;
        }
      }
    }

    return null;
  }

  /**
   * Get the currently cached APK path for a branch (backward compatibility)
   */
  getCachedAPKPath(branch: string = 'develop'): string | null {
    return this.getCachedBuildPath(branch, 'android');
  }

  /**
   * Get the currently cached IPA path for a branch
   */
  getCachedIPAPath(branch: string = 'develop'): string | null {
    return this.getCachedBuildPath(branch, 'ios');
  }

  /**
   * Download and cache a specific IPA by build slug
   */
  async downloadSpecificIPA(buildSlug: string, branch: string, forceDownload: boolean = false): Promise<string | null> {
    console.log(`🔍 Downloading specific iOS build: ${buildSlug}`);
    
    try {
      // Get build info for the specific slug first
      const buildResponse = await this.client.get(`/apps/${this.config.appSlug}/builds/${buildSlug}`);
      const buildData = buildResponse.data.data;
      
      // Check if this specific build is already cached (unless force download)
      if (!forceDownload) {
        const metadata = this.getCachedMetadata();
        const cacheKey = `${branch}-${buildData.build_number}`;
        const cached = metadata[cacheKey];
        
        if (cached && cached.buildSlug === buildSlug && fs.existsSync(cached.filePath)) {
          // Verify file integrity
          const currentChecksum = this.calculateChecksum(cached.filePath);
          if (currentChecksum === cached.checksum) {
            console.log(`✅ iOS Build #${buildData.build_number} (${buildSlug}) already cached`);
            console.log(`📦 Using cached file: ${cached.filePath}`);
            return cached.filePath;
          } else {
            console.log(`⚠️ Cached file corrupted, re-downloading...`);
          }
        }
      }
      
      const buildInfo: BuildInfo = {
        buildNumber: buildData.build_number,
        buildSlug: buildData.slug,
        status: buildData.status_text,
        branch: buildData.branch,
        commitHash: buildData.commit_hash,
        commitMessage: buildData.commit_message,
        triggeredAt: buildData.triggered_at,
        finishedAt: buildData.finished_at,
        workflow: buildData.triggered_workflow || 'default'
      };

      console.log(`📱 Found iOS build #${buildInfo.buildNumber} (${buildInfo.commitHash || 'no commit'})`);

      // Get artifacts
      const artifacts = await this.getBuildArtifacts(buildInfo.buildSlug);
      
      // Find IPA (iOS App Store Package)
      const ipaArtifacts = artifacts.filter(a => 
        (a.title.toLowerCase().endsWith('.ipa') || a.artifactType === 'ios-ipa')
      );

      const ipaArtifact = ipaArtifacts[0]; // Take first IPA found

      if (!ipaArtifact) {
        console.log('❌ No IPA artifact found in build');
        return null;
      }

      console.log(`📦 Selected iOS artifact: ${ipaArtifact.title} (${(ipaArtifact.fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`);

      // Get download URL
      const artifactResponse = await this.client.get(
        `/apps/${this.config.appSlug}/builds/${buildInfo.buildSlug}/artifacts/${ipaArtifact.slug}`
      );

      const downloadUrl = artifactResponse.data.data.expiring_download_url;

      // Prepare file path
      const iosDir = path.join(this.config.appsDir, 'ios');
      if (!fs.existsSync(iosDir)) {
        fs.mkdirSync(iosDir, { recursive: true });
      }

      const filename = `app-${branch}-build-${buildInfo.buildNumber}.ipa`;
      const filePath = path.join(iosDir, filename);

      // Download file
      console.log(`💾 Downloading iOS build to: ${filePath}`);
      const downloadResponse = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            process.stdout.write(`\rDownloading iOS build: ${percentCompleted}%`);
          }
        }
      });

      const writer = fs.createWriteStream(filePath);
      downloadResponse.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      console.log('\n✅ iOS build download complete');

      // Calculate checksum and save metadata
      const checksum = this.calculateChecksum(filePath);
      const stats = fs.statSync(filePath);
      
      const metadata = this.getCachedMetadata();
      const cacheKey = `${branch}-${buildInfo.buildNumber}`;
      
      metadata[cacheKey] = {
        buildNumber: buildInfo.buildNumber,
        buildSlug: buildInfo.buildSlug,
        branch: buildInfo.branch,
        commitHash: buildInfo.commitHash,
        downloadedAt: new Date().toISOString(),
        filePath,
        fileSize: stats.size,
        checksum
      };

      this.saveCachedMetadata(metadata);

      // Clean old IPAs from the same branch (keep last 3)
      this.cleanOldBuilds(branch, 3);

      return filePath;
    } catch (error) {
      console.error('Error downloading specific iOS build:', error);
      throw error;
    }
  }

  /**
   * Download and cache the latest IPA
   */
  async downloadLatestIPA(branch: string = 'develop', forceDownload: boolean = false): Promise<string | null> {
    // Check cache first
    if (!forceDownload) {
      const cacheCheck = await this.isLatestBuildCached(branch);
      if (cacheCheck.cached && cacheCheck.buildInfo) {
        const metadata = this.getCachedMetadata();
        const cacheKey = `${branch}-${cacheCheck.buildInfo.buildNumber}`;
        console.log(`📦 Using cached iOS IPA: ${metadata[cacheKey].filePath}`);
        return metadata[cacheKey].filePath;
      }
    }

    console.log(`🔍 Fetching latest iOS build for branch: ${branch}`);
    const latestBuild = await this.getLatestSuccessfulBuild(branch);
    
    if (!latestBuild) {
      console.log(`❌ No successful iOS builds found for branch: ${branch}`);
      return null;
    }

    return this.downloadSpecificIPA(latestBuild.buildSlug, branch, forceDownload);
  }

  /**
   * Update WebdriverIO config with the APK path
   */
  updateWdioConfig(apkPath: string): void {
    const configPath = path.join(process.cwd(), 'config', 'wdio.android.conf.ts');
    
    if (!fs.existsSync(configPath)) {
      console.warn('❌ wdio.android.conf.ts not found');
      return;
    }

    let config = fs.readFileSync(configPath, 'utf8');
    const apkFilename = path.basename(apkPath);
    
    // Update the app path
    config = config.replace(
      /'appium:app':\s*path\.join\([^)]+\),?/,
      `'appium:app': path.join(__dirname, '..', 'apps', 'android', '${apkFilename}'),`
    );

    fs.writeFileSync(configPath, config);
    console.log(`✅ Updated wdio.android.conf.ts with: ${apkFilename}`);
  }
}