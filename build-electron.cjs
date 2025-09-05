const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🚀 Building Arkive Tax Management System for Desktop...\n');

try {
  // Step 0: Paths
  const rootDir = process.cwd();
  const viteDistDir = path.join(rootDir, 'dist');
  const electronDir = path.join(rootDir, 'electron');
  const electronDistDir = path.join(electronDir, 'dist');
  const assetsDir = path.join(electronDir, 'assets');

  // Step 1: Clean old builds
  console.log('🧹 Cleaning old builds...');
  fs.removeSync(viteDistDir);
  fs.removeSync(electronDistDir);
  fs.removeSync(path.join(electronDir, 'dist'));
  fs.removeSync(path.join(electronDir, 'win-unpacked'));
  console.log('✅ Old builds removed.\n');

  // Step 2: Build the web app with optimizations
  console.log('📦 Step 1: Building optimized web application...');
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Web application built successfully!\n');

  // Step 3: Copy web build into electron/dist
  console.log('📂 Step 2: Copying web build to Electron folder...');
  fs.copySync(viteDistDir, electronDistDir, { overwrite: true });
  console.log('✅ Web build copied to Electron.\n');

  // Step 4: Prepare Electron environment
  console.log('📁 Step 3: Preparing Electron environment...');
  if (!fs.existsSync(electronDir)) throw new Error('Electron directory not found!');
  
  // Install/update Electron dependencies
  execSync('npm install', { stdio: 'inherit', cwd: electronDir });
  console.log('✅ Electron dependencies installed!\n');

  // Step 5: Ensure assets folder exists with proper icons
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log('📁 Created assets directory');
  }

  // Step 6: Create proper icon files (placeholder for now)
  const iconFiles = [
    { name: 'icon.png', content: 'Arkive Icon PNG - 256x256' },
    { name: 'icon.ico', content: 'Arkive Icon ICO - Windows' },
    { name: 'icon.icns', content: 'Arkive Icon ICNS - macOS' }
  ];
  
  iconFiles.forEach(({ name, content }) => {
    const iconPath = path.join(assetsDir, name);
    if (!fs.existsSync(iconPath)) {
      console.log(`⚠️  ${name} not found, creating placeholder...`);
      fs.writeFileSync(iconPath, content);
    }
  });

  // Step 7: Optimize dist folder for Electron
  console.log('🔧 Step 4: Optimizing for Electron...');
  
  // Update index.html for Electron
  const indexPath = path.join(electronDistDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Ensure all paths are relative
    indexContent = indexContent.replace(/href="\//g, 'href="./');
    indexContent = indexContent.replace(/src="\//g, 'src="./');
    
    // Add Electron-specific meta tags
    indexContent = indexContent.replace(
      '<head>',
      `<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';">`
    );
    
    fs.writeFileSync(indexPath, indexContent);
    console.log('✅ Index.html optimized for Electron');
  }

  // Step 8: Build desktop app
  console.log('🔨 Step 5: Building desktop application...');
  execSync('npm run build', { stdio: 'inherit', cwd: electronDir });
  console.log('\n🎉 SUCCESS! Desktop application built successfully!');

  // Step 9: Display build information
  const distPath = path.join(electronDir, 'dist');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    const exeFiles = files.filter(f => f.endsWith('.exe') || f.endsWith('.AppImage') || f.endsWith('.dmg'));
    
    console.log('\n📍 Build Location: electron/dist/');
    console.log('📁 Generated Files:');
    exeFiles.forEach(file => {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
      console.log(`   • ${file} (${sizeMB} MB)`);
    });
    
    console.log('\n✨ Your Arkive Tax Management System is ready for distribution!');
    console.log('🎯 The .exe file can be distributed to other computers without requiring installation of Node.js or other dependencies.');
  }

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  
  // Enhanced error reporting
  if (error.message.includes('npm')) {
    console.log('\n💡 Troubleshooting Tips:');
    console.log('   • Ensure Node.js and npm are properly installed');
    console.log('   • Try deleting node_modules and running npm install');
    console.log('   • Check if all dependencies are compatible');
  }
  
  process.exit(1);
}