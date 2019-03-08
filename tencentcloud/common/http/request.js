'use strict';

const http = require('http');
const https = require('https');
const URL = require('url');
const querystring = require('querystring');

/**
 * 发起网络请求
 * 
 * @param {string} url 请求路径或完整网址
 * @param {object} opts 参数和配置
 * @param {string} opts.method Method，支持 GET、POST、PUT、DELETE，默认为 GET
 * @param {object} opts.headers Header
 * @param {object} opts.query Query
 * @param {object} opts.body Body
 * 
 * @returns {promise}
 */
function request(opts = {}) {
  console.info('request', opts);

  // 生成 Promise 对象
  const deferred = {};
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  // 注入默认选项
  opts = Object.assign({ method: 'GET', headers: {} }, opts);
  opts.method = opts.method.toUpperCase();

  // 序列化 query
  if (opts.query) {
    if (url.indexOf('?') < 0) {
      url += '?';
    } else {
      url += '&';
    }
    url += querystring.stringify(opts.query);
    delete opts.query;
  }

  // 序列化 body
  let body = opts.body;
  if (opts.body && typeof opts.body !== 'string') {
    body = JSON.stringify(opts.body);
  }
  delete opts.body;

  // 处理 URL
  const uri = URL.parse(opts.url);
  const protocol = uri.protocol === 'https:' ? https : http;
  if (!opts.host) {
    opts.host = uri.host;
  }
  if (!opts.path) {
    opts.path = uri.path;
  }
  delete opts.url;

  // 处理 form 参数
  if (opts.form) {
    body = querystring.stringify(opts.form);
    delete opts.form;
  }

  // 包裹请求
  const req = protocol.request(opts, function (res) {
    const raw = [];
    res.on('data', function (chunk) {
      raw.push(chunk);
    });
    res.on('end', async function () {
      let data = Buffer.concat(raw).toString();
      console.info('request.response', res.statusCode, res.headers['content-type'], data);

      let response = Object.create(null);
      response.statusCode = res.statusCode;
      response.headers = res.headers;
      response.body = data;

      try {
        if (response.headers['content-type'] && data && data.length) {
          if (response.headers['content-type'].indexOf('application/json') === 0) {
            response.body = JSON.parse(response.body);
          }

          if (response.headers['content-type'].indexOf('text/xml') === 0) {
            response.body = await xml2json(response.body);
          }
        }

        if (response.statusCode === 200 || response.statusCode === 201) {
          deferred.resolve(response);
        } else {
          console.error('request.response.error', response);
          deferred.reject(response);
        }
      } catch (e) {
        console.error(e);
        deferred.reject(response);
      }
    });
  });

  if (body) {
    req.write(body);
  }

  req.on('error', function (e) {
    console.error(e.message);
    deferred.reject(e);
  });

  req.end();

  return deferred.promise;
}

module.exports = request;