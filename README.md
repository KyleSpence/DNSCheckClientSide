# DNS Checker

A DNS record analysis tool with error detection capabilities, built for deployment on Cloudflare Pages. Uses client-side DNS-over-HTTPS queries and requires no server-side compute.

## Features

- Query all major DNS record types (A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV)
- Automated analysis of DNS configuration issues for main domains
- Subdomain support without configuration analysis
- DNS result caching and request debouncing
- Responsive design for desktop and mobile
- Hugo PaperMod theme integration
- Client-side DNS-over-HTTPS queries with CSP protection

## Quick Start

### Local Development
```bash
git clone <your-repo-url>
cd dns-checker
npm install
npm run dev
```

### Build for Production
```bash
npm run build
npm run serve
``` 

## Project Structure

```
dns-checker/
├── src/                    # Source files
│   ├── index.html         # Main HTML template with Hugo theme structure
│   ├── css/               # Stylesheets
│   │   ├── hugo-theme.css # Hugo theme base styles
│   │   └── main.css       # DNS checker specific styles
│   ├── js/                # JavaScript modules
│   │   ├── dns-query.js   # DNS query engine (placeholder)
│   │   ├── error-detector.js # Error detection engine (placeholder)
│   │   ├── theme-adapter.js  # Theme adaptation (placeholder)
│   │   └── ui-controller.js  # UI controller (placeholder)
│   └── assets/            # Static assets (images, etc.)
├── build/                 # Build output directory
├── package.json          # Project configuration and dependencies
├── build.js              # Build script for minification and optimization
└── README.md             # This file
```

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dns-checker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

1. Start the development server:
   ```bash
   npm run dev
   ```
   This will serve the files from the `src/` directory on `http://localhost:8000`

   Alternative (using Node.js http-server):
   ```bash
   npm run dev:node
   ```

2. Open your browser and navigate to `http://localhost:8000`

### Building for Production

1. Build the project:
   ```bash
   npm run build
   ```
   This will:
   - Clean the `build/` directory
   - Minify JavaScript, CSS, and HTML files
   - Copy all assets to the `build/` directory
   - Generate Cloudflare Pages configuration files

2. Serve the built files locally:
   ```bash
   npm run serve
   ```
   This will serve the built files from the `build/` directory on `http://localhost:8080`

### Available Scripts

- `npm run build` - Build the project for production
- `npm run dev` - Start development server (Python)
- `npm run dev:node` - Start development server (Node.js)
- `npm run clean` - Clean the build directory
- `npm run serve` - Serve built files locally
- `npm test` - Run tests (to be implemented)

## Build System

The build system (`build.js`) provides:

- **JavaScript Minification**: Using Terser with optimized settings
- **CSS Minification**: Using clean-css for optimal compression
- **HTML Minification**: Using html-minifier-terser
- **Asset Copying**: Preserves directory structure
- **Cloudflare Pages Configuration**: Generates `_headers` file with security and caching policies

### Build Configuration

The build process can be configured by modifying the `config` object in `build.js`:

```javascript
const config = {
    srcDir: 'src',
    buildDir: 'build',
    minifyJS: true,
    minifyCSS: true,
    minifyHTML: true,
    copyAssets: true
};
```

## Deployment

### Cloudflare Pages Deployment

#### 1. Build Locally
```bash
npm install
npm run build
```

#### 2. Deploy to Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Navigate to **Pages**
3. Click **"Create a project"**
4. Select **"Upload assets"**
5. Upload all files from the `build/` folder
6. Deploy

#### 3. Custom Domain (Optional)
- In your Pages project, go to **Custom domains**
- Add your domain and configure DNS

## Implementation Status

- Project structure and build system
- DNS query engine with DoH API integration (Cloudflare, Google, Quad9)
- Error detection and analysis
- Hugo theme-consistent UI with responsive design
- Performance optimizations (caching, debouncing, lazy loading)
- Subdomain support with conditional issue detection
- Security headers and CSP configuration
- Mobile-responsive interface
- DNS record type validation and parsing
- Cloudflare Pages deployment configuration

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with Hugo theme adaptation
- **DNS Resolution**: DNS-over-HTTPS (DoH) APIs
- **Build System**: Node.js with Terser, clean-css, html-minifier-terser
- **Deployment**: Cloudflare Pages
- **DNS Providers**: Cloudflare DoH, Google Public DNS, Quad9

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT License and Apache License - see LICENSE file for details.

## Contributing

I am in no way a programmer, my focus is security, networking and system administration. This project was vibe coded with Kiro. This project follows a spec-driven development approach. See the implementation tasks in `.kiro/specs/dns-checker/tasks.md` for planned features and development progress.