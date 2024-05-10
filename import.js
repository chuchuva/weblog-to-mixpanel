import Alpine from 'alpine';
import dayjs from 'dayjs';
import { isbot } from "isbot";
import md5 from 'md5';
import mixpanelImport from 'mixpanel-import';
import { open } from 'node:fs/promises';
import UAParser from 'ua-parser-js';

import customParseFormat from 'dayjs/plugin/customParseFormat.js'
dayjs.extend(customParseFormat)

const alpine = new Alpine();

async function go() {
  const file = await open('new.log');
  const events = [];
  for await (const line of file.readLines()) {
    const request = parseLine(line);
    
    if (shouldImport(request)) {
      setIds(request.properties);
      events.push({ event: getEventName(request.properties.current_url_path),
        properties: request.properties });
    }
  }

  const importedData = await mixpanelImport(null, events);
  if (importedData.errors.length > 0) {
    console.error(importedData.errors);
    console.error(importedData.errors[0]?.failed_records);
  }
}

function parseLine(line) {
  const parsedLine = alpine.parseLine(line);
  const request = {
    properties: {
      ip: parsedLine.remoteHost,
      time: dayjs(parsedLine.time, 'DD/MMM/YYYY:HH:mm:ss Z').unix()
    },
    userAgentString: parsedLine['RequestHeader User-agent'],
    status: parsedLine.status
  };
  parseRequestField(parsedLine.request, request);
  parseUserAgent(request.userAgentString, request.properties);
  const referrer = parsedLine['RequestHeader Referer'];
  if (isValueSet(referrer))
    request.properties['$referrer'] = referrer;

  return request;
}

// parses "GET / HTTP/1.1"
function parseRequestField(s, request) {
  const properties = request.properties;
  const [method, pathAndQuery] = s.split(' ');
  if (!method || !pathAndQuery) {
    request.method = "";
    properties.current_url_path = "";
    return;
  }
  request.method = method;
  properties.current_url_path = pathAndQuery;
  const questionMarkIndex = pathAndQuery.indexOf('?');
  if (questionMarkIndex >= 0) {
    properties.current_url_path = pathAndQuery.substring(0, questionMarkIndex);
    properties.current_url_search = pathAndQuery.substring(questionMarkIndex);
  }
}

function isValueSet(s) {
  return s && s != '-';
}

function parseUserAgent(userAgentString, properties) {
  if (!isValueSet(userAgentString))
    return;
  const uaParser = new UAParser(userAgentString);
  const result = uaParser.getResult();
  if (result.device.model)
    properties["$device"] = result.device.model;
  if (result.browser.name)
    properties["$browser"] = result.browser.name;
  if (result.os.name)
    properties["$os"] = result.os.name;
}

function getEventName(path) {
  return path == '/api/walks' ? 'Opened walks in app' : '$mp_web_page_view';
}

function setIds(properties) {
  const deviceId = md5(properties.ip);
  properties["$device_id"] = deviceId;
  properties.distinct_id = "$device:" + deviceId,
  properties["$insert_id"] = md5(properties.time + properties.ip +
    properties.current_url_path);
}

function shouldImport(request) {
  if (request.method != 'GET' || request.status != '200')
    return false;
  const path = request.properties.current_url_path;
  if (path == '/api/walks')
    return true;
  if (path.startsWith('/assets/') || path.startsWith('/api/') ||
      path.startsWith('/img/') || path.startsWith('/favicon') ||
      path.startsWith('/.'))
    return false;
  if (isbot(request.userAgentString))
    return false;

  return true;
}

console.log('hello!')
go();
