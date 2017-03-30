let pify = require('pify')
let sax = require('sax')
let _ = require('lodash')
let request = require('request')
let promisedRequest = pify(request)

let debug = require('debug')('unfurled')

let ogp = require('./lib/ogp')
let twitter = require('./lib/twitter')
let oembed = require('./lib/oembed')

let shouldRollup = [
  'og:image',
  'twitter:image',
  'twitter:player',
  'og:video',
  'og:audio'
]

var util = require('util')

module.exports = async function (url, opts) {
  opts = _.defaults(opts || Object.create(null), {
    ogp: true,
    twitter: true,
    oembed: true,
    other: true
  })

  let metadata = await scrape(url, opts)

  if (opts.oembed && metadata.oembed) {
    let oembedData = await fetch(metadata.oembed, true)

    if (_.get(oembedData, 'body')) {
      metadata.oembed = _(JSON.parse(oembedData.body))
        .pickBy((v, k) => _.includes(oembed, k))
        .mapKeys((v, k) => _.camelCase(k))
        .value()
    } else {
      metadata.oembed = null
    }
  }

  // debug(util.inspect(metadata, false, null))

  return metadata
}

function fetch (url, promisify = false) {
  // debug('fetch url=', url)

  let r = promisify ? promisedRequest : request
  return r.get({
    url,
    headers: {
      'user-agent': 'facebookexternalhit'
    }
  })
}

async function scrape (url, opts) {
  // debug('scrape url=', url)
  // debug('scrape opts=', opts)

  let unfurled = Object.create(null)

  return new Promise((resolve, reject) => {
    let parser = sax.parser(false, {
      lowercase: true
    })

    let req = fetch(url)

    parser.onerror = function (err) {
      reject(err)
    }

    parser.ontext = function (text) {
      let tag = parser.tagName

      if (tag === 'title' && opts.other) {
        (unfurled.other || (unfurled.other = {})).title = text
      }
    }

    function rollup (target, name, val) {
      let rollupAs = _.find(shouldRollup, function (k) {
        return _.startsWith(name, k)
      })

      if (!name || !val) return

      if (rollupAs) {
        let prop = !name ? 'url' : _.camelCase(name)
        rollupAs = _.camelCase(rollupAs)

        target = (target[rollupAs] || (target[rollupAs] = [{}]))

        let last = _.last(target)
        last = (last[prop] ? (target.push({}) && _.last(target)) : last)

        // debug('rollup prop=', prop)
        // debug('rollup val=', val)

        last[prop] = val

        return
      }

      let prop = _.camelCase(name)

      // debug('rollup prop=', prop)
      // debug('rollup val=', val)

      target[prop] = val
    }

    parser.onopentag = function ({ name, attributes: attr }) {
      let prop = attr.property || attr.name
      let val = attr.content || attr.value

      debug('OPENTAG')

      if (opts.oembed && attr.type === 'application/json+oembed') {
        unfurled.oembed = attr.href
        return
      }

      if (name !== 'meta') return

      if (opts.ogp && _.includes(ogp, prop)) {
        let target = (unfurled.ogp || (unfurled.ogp = {}))

        rollup(target, prop, val)

        return
      }

      if (opts.twitter && _.includes(twitter, prop)) {
        let target = (unfurled.twitter || (unfurled.twitter = {})) // [prettyDest]

        rollup(target, prop, val)

        return
      }

      if (opts.other) {
        let target = (unfurled.other || (unfurled.other = {}))

        rollup(target, prop, val)

        return
      }
    }

    parser.onclosetag = function (tag) {
      if (tag === 'head') {
        console.log('ABORTING')

        req.abort() // Parse as little as possible.
        parser.flush()

        resolve(unfurled)
      }
    }

    req.on('data', (data) => {
      let isAborted = req._aborted

      debug('isAborted', isAborted)

      debug('GOT DATA', +new Date())

      if (parser.write(data) === false) req.pause()
      else parser.flush()
    })

    req.on('drain', () => {
      req.resume()
    })

    req.on('abort', () => {
      debug('ABORTED')
    })

    req.on('end', () => {
      resolve(unfurled)
    })
  })
}
