import Cdp from 'chrome-remote-interface';
import config from '../config';
import {log, sleep} from '../utils';


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
  let {queryStringParameters: {url, ...printParameters}} = request;
  const printOptions = makePrintOptions(printParameters);
  let pdf;

  log('Processing PDFification for', url, printOptions);

  log('request-request-request-request-request-request-request-request-request-request-');
  log(request);

  try {
    unpackWebpage(request);
  } catch (error){
    throw new Error('Unable to unpack document');
  }


  const startTime = Date.now();
  // url = 'file:///home/marek/Downloads/local-page/Mystical%20Smoking%20Head%20of%20\'Bob\'.html';
  try {
    // pdf = await printUrlToPdf(url, printOptions);
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
    body: Buffer.from(pdf, 'base64'),
    headers: {
      'Content-Type': 'application/pdf',
    },
  };

  result.body = Buffer.from(pdf, 'base64');
  result.headers['Content-Type'] = 'application/pdf';

  return result;
})


function unpackWebpage(pathToFile) {


}
