// var request = require('request')
// var debug = require('debug')
//
// var req = request.get({
//   url: 'https://google.com',
//   gzip: false
// })
//
// var debug = require('debug')('test')
//
// var ran = 0
// req.on('data', (data) => {
//   debug('GOT DATA')
//
//   debug('IS ABORTED', req._aborted)
//
//   if (++ran === 1) req.abort()
// })
//
// req.on('abort', () => debug('GOT ABORT!'))
//
// req.on('end', () => debug('GOT END'))
//
//



var requests = 0
var og = require('../')

function work () {
  og('https://medium.freecodecamp.com/how-you-can-land-a-6-figure-job-in-tech-with-no-connections-6eed0de26ea4')
    .then(result => {
      // console.log(require('util').inspect(result, false, null))
      // console.log('requests', ++requests)
    })
    .catch(err => console.error)
}//()

// setInterval(work, 100)
work()
