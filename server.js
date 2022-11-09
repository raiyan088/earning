const express = require('express')
const path = require('path')

const app = express()

app.listen(process.env.PORT || 3000, () => {
    console.log('Listening on port 3000 ...')
})

app.get('/', function(request, response){
    response.sendFile(path.join(__dirname, 'index.html'))
})

app.get('/monero.js', function(request, response){
    response.sendFile(path.join(__dirname, 'monero.js'))
})

app.get('/worker.js', function(request, response){
    response.sendFile(path.join(__dirname, 'worker.js'))
})

app.get('/worker.cn.js', function(request, response){
    response.sendFile(path.join(__dirname, 'worker.cn.js'))
})