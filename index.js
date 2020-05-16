/*!
 *
 */

const url = require('url')
    , http = require('http')
    , axios = require('axios')
    , jq = require('node-jq')
    , isTld = require('is-tld')
    , port = process.env.PORT || 3000

module.exports = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.writeHead(405).end('{"error":"Method not allowed"}')
    }

    const input = url.parse(req.url, true)
        , options = new URLSearchParams(input.query)
        , filter = options.has('@filter') ? options.get('@filter') : '.'

    if (!isTld(input.pathname.split('/')[1].split('.').slice(1).pop())) {
        return res.writeHead(400).end('{"error":"Invalid TLD domain request"}')
    }

    const negative = ['0', 'false', 'not', 'no']
        , method = options.get('@method') || 'get'
        , timeout = options.has('@timeout') ? parseInt(options.get('@timeout')) : 3000
        , protocol = options.get('@protocol') || 'https'
        , prefix = options.get('@prefix') || ''
        , suffix = options.get('@suffix') || ''
        , append = options.get('@append') || ''
        , prepend = options.get('@prepend') || ''
        , sort = options.has('@sort') && negative.indexOf(options.get('@sort')) === -1
        , raw = options.has('@raw') && negative.indexOf(options.get('@raw')) === -1

    let transform = function (value) { return value }

    if (options.has('@transform')) {
        const transformer = options.get('@transform')
        if (transformer) {
            const transformers = {
                md5: function(value) { return require('md5')(value) },
            }
            if (typeof transformers[transformer] !== 'undefined') {
                transform = transformers[transformer]
            } else {
                return res.writeHead(422).end('Invalid @transform value')
            }
        }
    }

    const request = {
        url: protocol + ':/' + input.pathname,
        method: method,
        timeout: timeout
    }

    const data = new URLSearchParams()
    const params = new URLSearchParams()

    for (let option of options.entries()) {
        if (option[0].substr(0, 5) === 'data:') {
            data.append(option[0].substring(5), option[1])
        } else if (option[0][0] !== '@') {
            params.append(option[0], option[1])
        }
    }

    const body = data.toString()
    if (body) { request.data = body }

    const query = params.toString()
    if (query) { request.url += '?' + query }

    console.log(request)

    axios.request(request).then((resp) => {
        const json = typeof resp.data === 'object' ? JSON.stringify(resp.data) : resp.data
        jq.run(filter, json, {
            input: 'string',
            output: 'string',
            sort: sort,
            raw: raw,
        }).then((value)=> {
            res.writeHead(200).end(prefix + transform(prepend + value + append) + suffix);
        }).catch((error) => {
            res.writeHead(500).end('jq: ' + error.message)
        })
    }).catch((error) => {
        res.writeHead(500).end('axios: ' + error.message)
    })
}).listen(port, () => {
    console.log(`Server listen on port ${port}.`)
});
