import * as dotenv from 'dotenv';
import { BitriseService } from '../services/bitrise/bitrise.service';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function checkLatestBuild() {
    const service = new BitriseService();
    const branch = process.env.BRANCH || 'develop';
    
    console.log(`\n🔍 Checking latest build for branch: ${branch}\n`);
    
    const latestBuild = await service.getLatestSuccessfulBuild(branch);
    
    if (latestBuild) {
        console.log('📱 Latest Build on Bitrise:');
        console.log(`   Build Number: #${latestBuild.buildNumber}`);
        console.log(`   Branch: ${latestBuild.branch}`);
        console.log(`   Status: ${latestBuild.status}`);
        console.log(`   Triggered: ${new Date(latestBuild.triggeredAt).toLocaleString()}`);
        if (latestBuild.commitMessage) {
            console.log(`   Commit: ${latestBuild.commitMessage}`);
        }
    }
    
    const metadataPath = path.join(__dirname, '..', '.bitrise-cache', 'metadata.json');
    if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        const cachedBuilds = metadata[branch] || {};
        
        if (Object.keys(cachedBuilds).length > 0) {
            console.log('\n💾 Cached Builds:');
            Object.values(cachedBuilds).forEach((build: any) => {
                const isLatest = latestBuild && build.buildNumber === latestBuild.buildNumber;
                const indicator = isLatest ? ' ✅ (LATEST)' : '';
                console.log(`   Build #${build.buildNumber}${indicator}`);
                console.log(`      File: ${path.basename(build.filePath)}`);
                console.log(`      Downloaded: ${new Date(build.downloadedAt).toLocaleString()}`);
            });
        }
    }
    
    const appsDir = path.join(__dirname, '..', 'apps', 'android');
    if (fs.existsSync(appsDir)) {
        const files = fs.readdirSync(appsDir).filter(f => f.endsWith('.apk'));
        console.log('\n📂 Downloaded APKs:');
        files.forEach(file => {
            const filePath = path.join(appsDir, file);
            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`   ${file} (${sizeMB} MB)`);
        });
    }
    
    const configPath = path.join(__dirname, '..', 'config', 'wdio.android.conf.ts');
    if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const appMatch = configContent.match(/'appium:app':\s*path\.join\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*'([^']+)'\)/);
        if (appMatch) {
            console.log('\n⚙️  Currently configured APK:');
            console.log(`   ${appMatch[1]}`);
        }
    }
}

checkLatestBuild().catch(console.error);