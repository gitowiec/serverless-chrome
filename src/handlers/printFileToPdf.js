import Cdp from 'chrome-remote-interface';
import config from '../config';
import {log, sleep} from '../utils';
import fs from 'fs';
import decompress from 'decompress';
import path from 'path';

const defaultPrintOptions = {
    landscape: false,
    displayHeaderFooter: false,
    printBackground: true,
    scale: 1,
    paperWidth: 8.27, // aka A4
    paperHeight: 11.69, // aka A4
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    pageRanges: '',
};

function cleanPrintOptionValue(type, value) {
    const types = {string: String, number: Number, boolean: Boolean};
    console.log('type', type);
    console.log('value', value);
    return new types[type](value);
}

function makePrintOptions(options = {}) {
    return Object.entries(options).reduce(
        (printOptions, [option, value]) => ({
            ...printOptions,
            [option]: cleanPrintOptionValue(typeof defaultPrintOptions[option], value),
        }),
        defaultPrintOptions
    );
}

export async function printUrlToPdf(url, printOptions = {}) {
    const LOAD_TIMEOUT = (config && config.chrome.pageLoadTimeout) || 1000 * 60;
    let result;

    const [tab] = await Cdp.List();
    const client = await Cdp({host: '127.0.0.1', target: tab});

    const {Network, Page} = client;

    Network.requestWillBeSent((params) => {
        log('Chrome is sending request for:', params.request.url);
    });


    if (config.logging) {
        Cdp.Version((err, info) => {
            console.log('CDP version info', err, info);
        });
    }

    try {
        await Promise.all([
            Network.enable(), // https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-enable
            Page.enable(), // https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-enable
        ]);

        const loadEventFired = Page.loadEventFired();

        await Page.navigate({url}); // https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-navigate

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(`Page load timed out after ${LOAD_TIMEOUT} ms.`)), LOAD_TIMEOUT);
            loadEventFired.then(() => {
                clearTimeout(timeout);
                resolve();
            });
        });

        // https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF
        const pdf = await Page.printToPDF(printOptions);
        result = pdf.data;
    } catch (error) {
        console.error(error);
    }

    /* try {
      log('trying to close tab', tab)
      await Cdp.Close({ id: tab })
    } catch (error) {
      log('unable to close tab', tab, error)
    } */

    await client.close();

    return result;
}

export default (async function printFileToPdfHandler(request) {
    let {queryStringParameters: printParameters, body: binaryFileContents, resource: resourcePath} = request;

    const printOptions = makePrintOptions(printParameters || {});
    let pdf, url;

    log('Processing PDFification with print options', printOptions);


    try {
        url = await writeToDiskAndUnpackDocument(request.body);
    } catch (error) {
        throw new Error('Unable to unpack document');
    }

    console.log('urlurlurlurlurlurlurlurlurlurlurlurlurlurlurl', url);
    const startTime = Date.now();
    // url = 'file:///home/marek/Downloads/local-page/index.html';
    try {
        pdf = await printUrlToPdf(url, printOptions);
    } catch (error) {
        console.error('Error printing pdf for', url, error);
        throw new Error('Unable to print pdf');
    }

    const endTime = Date.now();

    // TODO: probably better to write the pdf to S3,
    // but that's a bit more complicated for this example.
    let result = {
        statusCode: 200,
        // it's not possible to send binary via AWS API Gateway as it expects JSON response from Lambda
        body: (Buffer.from(pdf, 'base64')).toString('binary'),
        // body: (Buffer.from(pdf, 'base64')).toString(),
        // body: Buffer.from(pdf, 'base64'),
        // body: pdf, //this works but curl command has to be piped into base64 -d > output.pdf
        headers: {
            'Content-Type': 'application/pdf',
        },
    };


    return result;
})


async function writeToDiskAndUnpackDocument(stringFileContents) {
    const fileUrlPrefix = 'file://';
    const workspace = '/tmp';
    const archiveToPrintPath = workspace + '/document.zip';
    const documentToPrintDir = workspace + '/documentDir';
    return (new Promise((resolve, reject) => {
        fs.writeFile(archiveToPrintPath, Buffer.from(stringFileContents, 'binary'), 'binary', (error) => {
            if (error) {
                return reject(error);
            }
            return resolve({archiveToPrintPath});
        });
    })).then((fileStats) => {
        return new Promise((resolve, reject) => {
            fs.mkdir(documentToPrintDir, 0o755, (error) => {
                // if (error) {
                //     return reject(error);
                // }
                fileStats.documentToPrintDir = documentToPrintDir;
                return resolve(fileStats);
            })
        });
    }).then((fileStats) => {

        return decompress(fileStats.archiveToPrintPath, fileStats.documentToPrintDir);

    }).then(files => {
        for (let i = 0; i <= files.length; ++i) {
            if (files[i].path.endsWith('index.html')) {
                return fileUrlPrefix + documentToPrintDir + '/' + files[i].path;
            }
        }
    }).catch((reason) => {
        log('Catching writeToDiskAndUnpackDocument exception reason', reason)
    });
}
