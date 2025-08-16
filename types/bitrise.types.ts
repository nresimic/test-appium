export interface BitriseConfig {
  apiToken: string;
  appSlug: string;
  baseUrl: string;
  cacheDir: string;
  appsDir: string;
}

export interface BuildInfo {
  buildNumber: number;
  buildSlug: string;
  status: string;
  branch: string;
  commitHash: string | null;
  commitMessage: string | null;
  triggeredAt: string;
  finishedAt: string | null;
}

export interface ArtifactInfo {
  title: string;
  slug: string;
  artifactType: string;
  fileSizeBytes: number;
}

export interface BuildMetadata {
  buildNumber: number;
  buildSlug: string;
  branch: string;
  commitHash: string | null;
  downloadedAt: string;
  filePath: string;
  fileSize: number;
  checksum: string;
}

export interface BitriseApiResponse {
  data: BitriseApiBuild[];
}

export interface BitriseApiBuild {
  build_number: number;
  slug: string;
  status_text: string;
  branch: string;
  commit_hash: string | null;
  commit_message: string | null;
  triggered_at: string;
  finished_at: string | null;
}

export interface BitriseArtifactResponse {
  data: BitriseApiArtifact[];
}

export interface BitriseApiArtifact {
  title: string;
  slug: string;
  artifact_type: string;
  file_size_bytes: number;
}