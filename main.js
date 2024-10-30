const { app, BrowserWindow } = require('electron');
const path = require('path');
const { exec } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'), // Optional preload for secure API access
    },
  });

  // Load the Camera.UI interface on port 8081
  win.loadURL('http://localhost:8081');
}

app.whenReady().then(() => {
  // Step 1: Build Camera.UI
  exec('npm run build', { cwd: path.join(__dirname) }, (buildErr, buildOut, buildStderr) => {
    if (buildErr) {
      console.error(`Build error: ${buildErr.message}`);
      return;
    }
    console.log(buildOut || buildStderr);

    // Step 2: Run the server in watch mode
    exec('npm run watch', { cwd: path.join(__dirname) }, (watchErr, watchOut, watchStderr) => {
      if (watchErr) {
        console.error(`Watch error: ${watchErr.message}`);
        return;
      }
      console.log(watchOut || watchStderr);
    });

    // Step 3: Open Electron window after build
    createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
