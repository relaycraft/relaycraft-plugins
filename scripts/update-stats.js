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

            // Handle redirects
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

// Cache for repo releases to avoid redundant API calls
const repoReleasesCache = {};

async function getAllRepoReleases(owner, repo) {
    const key = `${owner}/${repo}`;
    if (repoReleasesCache[key]) {
        return repoReleasesCache[key];
    }

    console.log(`Fetching all releases for ${owner}/${repo}...`);
    let allReleases = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100&page=${page}`;
        try {
            const releases = await fetchGitHubAPI(url);
            if (releases.length === 0) {
                hasMore = false;
            } else {
                allReleases = allReleases.concat(releases);
                if (releases.length < 100) {
                    hasMore = false; // Last page
                } else {
                    page++;
                }
            }
            // Rate limit safety
            await new Promise(r => setTimeout(r, 100));
        } catch (e) {
            console.warn(`Failed to fetch page ${page} of releases: ${e.message}`);
            hasMore = false;
        }
    }

    console.log(`  -> Found ${allReleases.length} releases.`);
    repoReleasesCache[key] = allReleases;
    return allReleases;
}

// Helper to parse GitHub release URL
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
    console.log('Starting plugin cumulative statistics update...');
    
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

    for (const plugin of pluginsData.plugins) {
        if (!plugin.downloadUrl) continue;

        const info = parseDownloadUrl(plugin.downloadUrl);
        if (!info) continue;

        // Fetch all releases for this repo (cached)
        const allReleases = await getAllRepoReleases(info.owner, info.repo);
        
        // Calculate cumulative downloads
        // Logic: Sum download_count of assets that match the plugin ID pattern
        // Pattern: {plugin_id}-v*.rcplugin
        // This is robust against version changes.
        
        let totalDownloads = 0;
        const assetPrefix = `${plugin.id}-v`;
        const assetSuffix = `.rcplugin`;

        for (const release of allReleases) {
            if (!release.assets) continue;
            
            for (const asset of release.assets) {
                // Check if asset name matches this plugin
                if (asset.name.startsWith(assetPrefix) && asset.name.endsWith(assetSuffix)) {
                    totalDownloads += asset.download_count;
                }
            }
        }

        console.log(`Plugin ${plugin.id}: Total Downloads = ${totalDownloads}`);
        
        plugin.downloadCount = totalDownloads;
        updatedCount++;
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
        console.log('\nNo updates were made.');
    }
}

// Run the script
updateStats().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
