#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { minify: terserMinify } = require('terser');
const CleanCSS = require('clean-css');
const { minify: htmlMinify } = require('html-minifier-terser');

// Configuration
const config = {
    srcDir: 'src',
    buildDir: 'build',
    minifyJS: true,
    minifyCSS: true,
    minifyHTML: true,
    copyAssets: true
};

// Utility functions
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
}

function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    ensureDirectoryExists(destDir);
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
}

async function minifyJavaScript(inputPath, outputPath) {
    try {
        const code = fs.readFileSync(inputPath, 'utf8');
        
        if (config.minifyJS) {
            const result = await terserMinify(code, {
                compress: {
                    drop_console: false, // Keep console logs for debugging
                    drop_debugger: true,
                    pure_funcs: ['console.debug']
                },
                mangle: {
                    reserved: ['DNSQuery', 'ErrorDetector', 'ThemeAdapter', 'UIController']
                },
                format: {
                    comments: false
                }
            });
            
            if (result.error) {
                throw result.error;
            }
            
            fs.writeFileSync(outputPath, result.code);
            console.log(`Minified JS: ${inputPath} -> ${outputPath}`);
        } else {
            copyFile(inputPath, outputPath);
        }
    } catch (error) {
        console.error(`Error minifying JavaScript ${inputPath}:`, error.message);
        // Fallback to copying the original file
        copyFile(inputPath, outputPath);
    }
}

function minifyCSS(inputPath, outputPath) {
    try {
        const css = fs.readFileSync(inputPath, 'utf8');
        
        if (config.minifyCSS) {
            const cleanCSS = new CleanCSS({
                level: 2,
                returnPromise: false
            });
            
            const result = cleanCSS.minify(css);
            
            if (result.errors.length > 0) {
                throw new Error(result.errors.join(', '));
            }
            
            fs.writeFileSync(outputPath, result.styles);
            console.log(`Minified CSS: ${inputPath} -> ${outputPath}`);
        } else {
            copyFile(inputPath, outputPath);
        }
    } catch (error) {
        console.error(`Error minifying CSS ${inputPath}:`, error.message);
        // Fallback to copying the original file
        copyFile(inputPath, outputPath);
    }
}

async function minifyHTML(inputPath, outputPath) {
    try {
        const html = fs.readFileSync(inputPath, 'utf8');
        
        if (config.minifyHTML) {
            const result = await htmlMinify(html, {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                useShortDoctype: true,
                minifyCSS: true,
                minifyJS: true
            });
            
            fs.writeFileSync(outputPath, result);
            console.log(`Minified HTML: ${inputPath} -> ${outputPath}`);
        } else {
            copyFile(inputPath, outputPath);
        }
    } catch (error) {
        console.error(`Error minifying HTML ${inputPath}:`, error.message);
        // Fallback to copying the original file
        copyFile(inputPath, outputPath);
    }
}

function copyDirectory(src, dest) {
    if (!fs.existsSync(src)) {
        return;
    }
    
    ensureDirectoryExists(dest);
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    }
}

async function processFile(filePath, srcDir, buildDir) {
    const relativePath = path.relative(srcDir, filePath);
    const outputPath = path.join(buildDir, relativePath);
    const ext = path.extname(filePath).toLowerCase();
    
    ensureDirectoryExists(path.dirname(outputPath));
    
    switch (ext) {
        case '.js':
            await minifyJavaScript(filePath, outputPath);
            break;
        case '.css':
            minifyCSS(filePath, outputPath);
            break;
        case '.html':
            await minifyHTML(filePath, outputPath);
            break;
        default:
            copyFile(filePath, outputPath);
            break;
    }
}

function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    }
    
    return fileList;
}

async function createCloudflareHeaders() {
    const headersContent = `# Cloudflare Pages Headers Configuration

/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cloudflare-dns.com https://dns.google https://dns.quad9.net

# Cache static assets for 1 year
/css/*
  Cache-Control: public, max-age=31536000, immutable

/js/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Cache HTML for 1 hour
/*.html
  Cache-Control: public, max-age=3600

# Root index file
/
  Cache-Control: public, max-age=3600
`;

    const headersPath = path.join(config.buildDir, '_headers');
    fs.writeFileSync(headersPath, headersContent);
    console.log('Created Cloudflare Pages _headers file');
}

async function build() {
    console.log('🚀 Starting DNS Checker build process...');
    console.log(`Source directory: ${config.srcDir}`);
    console.log(`Build directory: ${config.buildDir}`);
    
    // Clean build directory
    if (fs.existsSync(config.buildDir)) {
        fs.rmSync(config.buildDir, { recursive: true, force: true });
        console.log('Cleaned build directory');
    }
    
    // Create build directory
    ensureDirectoryExists(config.buildDir);
    
    try {
        // Get all files from src directory
        const allFiles = getAllFiles(config.srcDir);
        
        // Process each file
        for (const filePath of allFiles) {
            await processFile(filePath, config.srcDir, config.buildDir);
        }
        
        // Create Cloudflare Pages configuration files
        await createCloudflareHeaders();
        
        // Generate build summary
        const buildStats = {
            totalFiles: allFiles.length,
            jsFiles: allFiles.filter(f => f.endsWith('.js')).length,
            cssFiles: allFiles.filter(f => f.endsWith('.css')).length,
            htmlFiles: allFiles.filter(f => f.endsWith('.html')).length,
            assetFiles: allFiles.filter(f => !f.match(/\\.(js|css|html)$/)).length
        };
        
        console.log('\\n📊 Build Summary:');
        console.log(`Total files processed: ${buildStats.totalFiles}`);
        console.log(`JavaScript files: ${buildStats.jsFiles}`);
        console.log(`CSS files: ${buildStats.cssFiles}`);
        console.log(`HTML files: ${buildStats.htmlFiles}`);
        console.log(`Asset files: ${buildStats.assetFiles}`);
        
        console.log('\\n✅ Build completed successfully!');
        console.log(`Build output available in: ${config.buildDir}/`);
        console.log('\\nTo serve the built files locally:');
        console.log('  npm run serve');
        
    } catch (error) {
        console.error('\\n❌ Build failed:', error.message);
        process.exit(1);
    }
}

// Run build if this script is executed directly
if (require.main === module) {
    build().catch(error => {
        console.error('Build process failed:', error);
        process.exit(1);
    });
}

module.exports = { build, config };