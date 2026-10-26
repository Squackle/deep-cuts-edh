import {remoteJson,listHtml,htmlResponse} from '../../src/weekly-rescues-html.js';
export async function onRequestGet(){try{const data=await remoteJson('/v1/index');return htmlResponse(listHtml(data.reports))}catch(error){console.error('Rescue index upstream unavailable',String(error));return htmlResponse(listHtml([]),503)}}
