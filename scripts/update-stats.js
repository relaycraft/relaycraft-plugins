const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const PLUGINS_JSON_FILE = 'plugins.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Helper to fetch data from GitHub API
function fetchGitHubAPI(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'RelayCraft-Market-Updater',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        if (GITHUB_TOKEN) {
            options.headers['Authorization'] = `token ${GITHUB_TOKEN}`;
        }

        https.get(url, options, (res) => {
            let data = '';

            // Handle redirects (e.g., 301, 302, 307)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchGitHubAPI(res.headers.location).then(resolve).catch(reject);
            }

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
                    }
                } else {
                    reject(new Error(`GitHub API request failed: ${res.statusCode} ${res.statusMessage} - URL: ${url}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Helper to parse GitHub release URL
// Expected format: https://github.com/{owner}/{repo}/releases/download/{tag}/{filename}
function parseDownloadUrl(url) {
    try {
        const regex = /github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/(.+)$/;
        const match = url.match(regex);
        
        if (match) {
            return {
                owner: match[1],
                repo: match[2],
                tag: match[3],
                filename: match[4]
            };
        }
    } catch (e) {
        console.warn(`Failed to parse URL ${url}: ${e.message}`);
    }
    return null;
}

async function updateStats() {
    console.log('Starting plugin statistics update...');
    
    const filePath = path.resolve(__dirname, '..', PLUGINS_JSON_FILE);
    
    if (!fs.existsSync(filePath)) {
        console.error(`Error: ${PLUGINS_JSON_FILE} not found at ${filePath}`);
        process.exit(1);
    }

    let pluginsData;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        pluginsData = JSON.parse(content);
    } catch (e) {
        console.error(`Error reading ${PLUGINS_JSON_FILE}: ${e.message}`);
        process.exit(1);
    }

    if (!Array.isArray(pluginsData.plugins)) {
        console.error('Error: Invalid plugins.json format (missing "plugins" array)');
        process.exit(1);
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (const plugin of pluginsData.plugins) {
        if (!plugin.downloadUrl) {
            console.warn(`Skipping ${plugin.id}: No downloadUrl`);
            continue;
        }

        const info = parseDownloadUrl(plugin.downloadUrl);
        if (!info) {
            console.warn(`Skipping ${plugin.id}: Could not parse downloadUrl (${plugin.downloadUrl})`);
            continue;
        }

        console.log(`Processing ${plugin.id} (Version: ${plugin.version})...`);

        try {
            // Strategy: Get specific release by tag
            // API: GET /repos/{owner}/{repo}/releases/tags/{tag}
            const releaseUrl = `https://api.github.com/repos/${info.owner}/${info.repo}/releases/tags/${info.tag}`;
            const releaseData = await fetchGitHubAPI(releaseUrl);

            // Find matching asset
            const asset = releaseData.assets.find(a => a.name === info.filename);
            
            if (asset) {
                const currentDownloads = asset.download_count;
                // Update downloadCount in plugin object
                // Note: We are storing the download count for the CURRENT version.
                // If you want cumulative, you'd need a different strategy (scanning all releases).
                plugin.downloadCount = currentDownloads;
                
                console.log(`  -> Updated downloadCount: ${currentDownloads}`);
                updatedCount++;
            } else {
                console.warn(`  -> Asset '${info.filename}' not found in release '${info.tag}'`);
                failedCount++;
            }

        } catch (error) {
            console.error(`  -> Failed to fetch stats: ${error.message}`);
            failedCount++;
            // Don't abort, continue to next plugin
        }
        
        // Add a small delay to be nice to the API (even with token)
        await new Promise(r => setTimeout(r, 200));
    }

    // Write back to file
    if (updatedCount > 0) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(pluginsData, null, 4), 'utf8');
            console.log(`\nSuccess! Updated stats for ${updatedCount} plugins.`);
        } catch (e) {
            console.error(`Error writing file: ${e.message}`);
            process.exit(1);
        }
    } else {
        console.log('\nNo updates were made (either no changes or all requests failed).');
    }
    
    if (failedCount > 0) {
        console.warn(`WARNING: Failed to update ${failedCount} plugins.`);
    }
}

// Run the script
updateStats().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
