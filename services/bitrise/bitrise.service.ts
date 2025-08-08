import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

interface BitriseConfig {
  apiToken: string;
  appSlug: string;
  baseUrl: string;
  cacheDir: string;
  appsDir: string;
}

interface BuildInfo {
  buildNumber: number;
  buildSlug: string;
  status: string;
  branch: string;
  commitHash: string | null;
  commitMessage: string | null;
  triggeredAt: string;
  finishedAt: string | null;
}

interface ArtifactInfo {
  title: string;
  slug: string;
  artifactType: string;
  fileSizeBytes: number;
}

interface BuildMetadata {
  buildNumber: number;
  buildSlug: string;
  branch: string;
  commitHash: string | null;
  downloadedAt: string;
  filePath: string;
  fileSize: number;
  checksum: string;
}

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
          const branches = new Set(allBuildsResponse.data.data.map((b: any) => b.branch));
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
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Check your BITRISE_API_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Get build artifacts
   */
  async getBuildArtifacts(buildSlug: string): Promise<ArtifactInfo[]> {
    const response = await this.client.get(
      `/apps/${this.config.appSlug}/builds/${buildSlug}/artifacts`
    );

    return response.data.data.map((artifact: any) => ({
      title: artifact.title,
      slug: artifact.slug,
      artifactType: artifact.artifact_type,
      fileSizeBytes: artifact.file_size_bytes
    }));
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
    const branchBuilds = Object.entries(metadata)
      .filter(([key]) => key.startsWith(`${branch}-`))
      .sort((a, b) => b[1].buildNumber - a[1].buildNumber);

    if (branchBuilds.length > keepCount) {
      console.log(`🧹 Cleaning old builds (keeping last ${keepCount})`);
      
      branchBuilds.slice(keepCount).forEach(([key, build]) => {
        // Delete file if it exists
        if (fs.existsSync(build.filePath)) {
          fs.unlinkSync(build.filePath);
          console.log(`  Deleted: ${path.basename(build.filePath)}`);
        }
        // Remove from metadata
        delete metadata[key];
      });

      this.saveCachedMetadata(metadata);
    }
  }

  /**
   * Get the currently cached APK path for a branch
   */
  getCachedAPKPath(branch: string = 'develop'): string | null {
    const metadata = this.getCachedMetadata();
    const branchBuilds = Object.entries(metadata)
      .filter(([key]) => key.startsWith(`${branch}-`))
      .sort((a, b) => b[1].buildNumber - a[1].buildNumber);

    if (branchBuilds.length > 0 && fs.existsSync(branchBuilds[0][1].filePath)) {
      return branchBuilds[0][1].filePath;
    }

    return null;
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