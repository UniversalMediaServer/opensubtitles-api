'use strict'

// requirejs modules
const got = require('got')
const methods = require('./methods.json')
const pkg = require('./package.json')

// default settings
const defaultUrl = 'https://www.opensubtitles.com/api/v1'
const defaultUa = `${pkg.name}/${pkg.version} (NodeJS; +${pkg.repository.url})`

// wrapper
module.exports = class OpenSubtitles {
  constructor(settings = {}) {
    if (!settings.api_key) throw Error('Missing api key')

    this._authentication = {}
    this._settings = {
      api_key: settings.api_key,
      endpoint: settings.api_url || defaultUrl,
      debug: settings.debug || false,
      useragent: settings.useragent || defaultUa
    }

    this._construct()
  }

  // Creates methods for all requests
  _construct() {
    for (let url in methods) {
      const urlParts = url.split('/')
      const name = urlParts.pop() // key for function

      let tmp = this
      for (let p = 1; p < urlParts.length; ++p) { // acts like mkdir -p
        tmp = tmp[urlParts[p]] || (tmp[urlParts[p]] = {})
      }

      tmp[name] = (() => {
        const method = methods[url] // closure forces copy
        return (params) => {
            return this._call(method, params)
        }
      })()
    }

    this._debug(`Opensubtitles-api: module loaded, as ${this._settings.useragent}`)
  }

  // Parse url before api call
  _parse(method, params) {
    if (!params) params = {}

    const queryParts = []
    const pathParts = []

    // ?Part
    const queryPart = method.url.split('?')[1]
    if (queryPart) {
      const queryParams = queryPart.split('&')
      for (let i in queryParams) {
        const name = queryParams[i].split('=')[0]
        (params[name] || params[name] === 0) && queryParts.push(`${name}=${encodeURIComponent(params[name])}`)
      }
    }

    // /part
    const pathPart = method.url.split('?')[0]
    const pathParams = pathPart.split('/')
    for (let k in pathParams) {
      if (pathParams[k][0] != ':') {
        pathParts.push(pathParams[k])
      } else {
        const param = params[pathParams[k].substr(1)]
        if (param || param === 0) {
          pathParts.push(param)
        } else {
          // check for missing required params
          if (method.optional && method.optional.indexOf(pathParams[k].substr(1)) === -1) throw Error(`Missing mandatory paramater: ${pathParams[k].substr(1)}`)
        }
      }
    }

    return [
      this._settings.endpoint,
      pathParts.join('/'),
      queryParts.length ? `?${queryParts.join('&')}` : ''
    ].join('')
  }

  // Parse methods then hit trakt
  _call(method, params) {
    if (method['auth'] === true && (!this._authentication.access_token)) throw Error('User authentication required')

    const req = {
      method: method.method,
      url: this._parse(method, params),
      headers: {
        'User-Agent': this._settings.useragent,
        'Content-Type': method['Content-Type'] || 'application/json',
        'Api-Key': this._settings.api_key
      },
      body: (method.body ? Object.assign({}, method.body) : {})
    }

    if (method.opts['auth'] && this._authentication.access_token) req.headers['Authorization'] = `Bearer ${this._authentication.access_token}`

    for (let k in params) {
      if (k in req.body) req.body[k] = params[k]
    }
    for (let k in req.body) {
      if (!req.body[k]) delete req.body[k]
    }

    if (method.method === 'GET') {
      delete req.body
    } else {
      req.body = JSON.stringify(req.body)
    }

    this._debug(req)
    return got(req)
  }

  // Debug & Print
  _debug(req) {
    this._settings.debug && console.log(req.method ? `${req.method}: ${req.url}` : req)
  }

  login() {}
}