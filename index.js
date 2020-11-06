const { createWriteStream, existsSync, readFileSync } = require('fs');
const { remote } = require('electron');
const unzip = require('unzip-crx');
const { join } = require('path');

const { Plugin } = require('@vizality/entities');
const { get } = require('@vizality/http');

module.exports = class ReactDevtools extends Plugin {
  get path () {
    return join(__dirname, 'rdt.crx');
  }

  get folderPath () {
    return join(__dirname, 'react-dev-tools');
  }

  get isInstalledLocally () {
    return existsSync(this.path);
  }

  onStart () {
    this.listener = this.listener.bind(this);
    if (!this.isInstalledLocally) {
      this.download();
    }

    this.checkForUpdate();

    remote.getCurrentWindow().webContents.on('devtools-opened', this.listener);
    if (remote.getCurrentWindow().webContents.isDevToolsOpened()) {
      this.listener();
    }
  }

  onStop () {
    remote
      .getCurrentWindow()
      .webContents.removeListener('devtools-opened', this.listener);
  }

  listener () {
    remote.BrowserWindow.removeDevToolsExtension('React Developer Tools');

    if (this.isInstalledLocally) {
      if (remote.BrowserWindow.addDevToolsExtension(this.folderPath)) {
        this.log('Successfully installed React DevTools.');
        this.log('If React DevTools is missing or empty, close Chrome DevTools and re-open it.');
      } else {
        this.error('Couldn\'t find React DevTools in Chrome extensions!');
      }
    }
  }

  checkForUpdate () {
    const local = readFileSync(this.path);
    const crxLink = 'https://clients2.google.com/service/update2/crx?response=redirect&os=win&arch=x86-64&os_arch=x86-64&nacl_arch=x86-64&prod=chromecrx&prodchannel=unknown&prodversion=77.0.3865.90&acceptformat=crx2&x=id=fmkadmapgofadopljbjfkapdkoienihi%26uc';
    return get(crxLink).then(res => {
      if (res.body !== local) {
        this.download();
      }
    }, err => this.error(err));
  }

  download () {
    const crxLink = 'https://clients2.google.com/service/update2/crx?response=redirect&os=win&arch=x86-64&os_arch=x86-64&nacl_arch=x86-64&prod=chromecrx&prodchannel=unknown&prodversion=77.0.3865.90&acceptformat=crx2&x=id=fmkadmapgofadopljbjfkapdkoienihi%26uc';
    return get(crxLink).then(res => get(res.headers.location).then(resp => {
      const crxFile = createWriteStream(this.path);
      crxFile.write(resp.body, err => {
        if (err) {
          this.error(err);
        }
        return crxFile.close();
      });

      unzip(this.path, this.folderPath).then(() => {
        this.listener();
        this.log('If you are still unable to find tabs for React DevTools in Chrome DevTools, reload your client (Ctrl + R).');
      });
    }, err => this.error(err)), err => this.error(err));
  }
};
