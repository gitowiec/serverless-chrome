const path = require('path')
const decompress = require('decompress')
const chromeTarball = path.join(__dirname, 'chrome/chrome-headless-lambda-linux-x64.tar.gz')
const webpackDir = path.join(__dirname, '.webpack/')


function ExtractTarballPlugin(archive, to) {
    decompress(path.resolve(archive), path.resolve(to))
        .then((files) => console.log(files))
        .catch(error => console.error('Unable to extract archive ', archive, to, error.stack))
}




ExtractTarballPlugin(chromeTarball, webpackDir)
