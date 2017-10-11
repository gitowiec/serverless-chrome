import config from './config'
import {spawn as spawnChrome} from './chrome'
import {log} from './utils'
import 'source-map-support/register';

// eslint-disable-next-line import/prefer-default-export
export async function run(event, context, callback, handler = config.handler) {

    const request = event;

    // log('request-request-request-request-request-request-request-request-request-request-');
    // log(request);
    // log('context-context-context-context-context-context-context-context-context-context-');
    // log(context);
    // log('callback-callback-callback-callback-callback-callback-callback-callback-callback-');
    // log(callback);

    let handlerResult = {}
    let handlerError = null

    // try {
    //   await spawnChrome()
    // } catch (error) {
    //   console.error('Error in spawning Chrome')
    //   return callback(error)
    // }

    try {
        handlerResult = await handler(request, context)
    } catch (error) {
        console.error('Error in handler:', error)
        handlerError = error
    }

    log('Handler result:', JSON.stringify(handlerResult, null, ' '))

    return callback(handlerError, handlerResult)
}
