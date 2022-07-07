window.addEventListener('DOMContentLoaded', async(event) => {
    const trezor = new TrezorClient()
    const dbs = new Map()
    function sleep(ms=1000) { return new Promise(resolve => setTimeout(resolve, ms)); }
    try {
        window.mpurse.updateEmitter.removeAllListeners()
          .on('stateChanged', async(isUnlocked) => { await init(); console.log(isUnlocked); })
          .on('addressChanged', async(address) => { await init(address); console.log(address); });
    } catch(e) { console.debug(e) }
    document.getElementById('get-transaction').addEventListener('click', async(event) => {
        //await debug()
        //return;
        const address = document.getElementById('address').value
        if (!address) { return }
        console.debug(address)
        console.debug(dbs)
        console.debug(dbs.get(address))
        console.debug(dbs.get(address).dexie)
        console.debug(dbs.get(address).dexie.last)
        //const last = await dbs.get(address).dexie.last.toArray()
        const last = await dbs.get(address).dexie.last.get(1)
        console.debug(last)
        const options = {}
        if (last) { // 前回データがあるなら一旦それを表示する
            options.from = last.lastBlockHeight
        }
        console.debug(options)
        // 最新データを取得する
        let lastBlockHeight = -1
        let lastTxId = -1
        let balance = -1
        let totalReceived = -1
        let totalSent = -1
        let unconfirmedBalance = -1
        let unconfirmedTxs = -1
        let newFees = 0
        let sendCount = 0
        let receiveCount = 0
        let sendAddressCount = 0
        let receiveAddressCount = 0
        //console.debug(await trezor.address(address, options))
        //for await (let res of trezor.address(address, options)) {
        for await (const res of trezor.address(address, options)) {
            if (!res) { break }
            console.debug(res)
            document.getElementById('response').value = JSON.stringify(res)
            let newTxIds = res.txids
            if (last) { // 前回データがあるなら最新データからそれ以前のデータを削除する
                const lastTxIdIdx = res.txids.findIndex(txid=>txid===last.lastTxId)
                console.debug(lastTxIdIdx)
                if (-1 < lastTxIdIdx) {
                    newTxIds = res.txids.slice(0, lastTxIdIdx)
                }
            }
            console.debug(newTxIds)
            for (let i=0; i<newTxIds.length; i++) {
                const tx = await trezor.tx(newTxIds[i])
                if (-1 === lastTxId) { // 初回なら
                    lastBlockHeight = tx.blockHeight 
                    lastTxId = tx.txid
                    balance = res.balance
                    totalReceived = res.totalReceived 
                    totalSent = res.totalSent 
                    unconfirmedBalance = res.unconfirmedBalance 
                    unconfirmedTxs = res.unconfirmedTxs 
                }
                //newFees += tx.fees
                newFees += parseInt(tx.fees)
                console.debug(tx)
                //const addrs = new Set([...tx.vin.map(v=>v.addresses), ...tx.vout.map(v=>v.addresses)])
                const isPay = tx.vin.some(v=>v.addresses.includes(address))
                const value = (isPay) ? parseInt(tx.vin[tx.vin.findIndex(v=>v.addresses.includes(address))].value) - parseInt(tx.vout[tx.vout.findIndex(v=>v.addresses.includes(address))].value) : parseInt(tx.vout[tx.vout.findIndex(v=>v.addresses.includes(address))].value)
                //const addrsAry = (isPay) ? tx.vout.map(v=>v.addresses) : tx.vin.map(v=>v.addresses)
                const addrsAry = ((isPay) ? tx.vout.map(v=>v.addresses) : tx.vin.map(v=>v.addresses)).flat()
                console.debug(addrsAry)
                //const addrs = new Set((isPay) ? tx.vout.map(v=>v.addresses) : tx.vin.map(v=>v.addresses))
                const addrs = new Set(((isPay) ? tx.vout.map(v=>v.addresses) : tx.vin.map(v=>v.addresses)).flat())
                console.debug(addrs)
                addrs.delete(address)
                console.debug(addrs)
                if (isPay) { sendCount++; } 
                else { receiveCount++; }
                if (0 === tx.confirmations) { console.error('未承認トランザクションです！', tx) }
                console.debug(dbs.get(address))
                console.debug(dbs.get(address).dexie.transactions)
                dbs.get(address).dexie.transactions.put({
                    txid: tx.txid, // newTxIds[i]
                    isPay: isPay,
                    addresses: Array.from(addrs).join(','),
                    value: value,
                    fee: parseInt(tx.fees),
                    confirmations: tx.confirmations,
                    blockTime: tx.blockTime,
                    blockHeight: tx.blockHeight,
                })
                // 進捗表示
                console.debug(`${(((i+1)/newTxIds.length)*100).toFixed(2)}% ${i+1}/${newTxIds.length}`)
                console.debug(dbs.get(address).dexie.transactions.get(tx.txid))


                // デバッグ
                break
            }

            // デバッグ
            //return
            console.debug('XXXXXXXXXXJDJDJD')
            const count = ((last) ? last.count : 0) + newTxIds.length
            const fee = ((last) ? last.fee : 0) + newFees
            const txs = await dbs.get(address).dexie.transactions.toArray()
            const payTxs = txs.filter(tx=>tx.isPay)
            const receiveTxs = txs.filter(tx=>!tx.isPay)
            const payAddrs = new Set(payTxs.map(tx=>tx.addresses))
            const receiveAddrs = new Set(receiveTxs.map(tx=>tx.addresses))
            const record = {
                id: 1,
                count: count,
                lastBlockHeight: lastBlockHeight,
                lastTxId: lastTxId,
                sendValue: parseInt(totalSent),
                receiveValue: parseInt(totalReceived),
                balance: parseInt(balance),
                fee: fee,
                unconfirmedBalance: parseInt(unconfirmedBalance),
                unconfirmedTxs: unconfirmedTxs,
                sendCount: sendCount,
                receiveCount: receiveCount,
                sendAddressCount: payAddrs.size,
                receiveAddressCount: receiveAddrs.size,
            }
            await dbs.get(address).dexie.last.put(record)
            Array.from(payAddrs)
            for (const addr of payAddrs.values()) {
                const addrPayTxs = txs.filter(tx=>tx.isPay && tx.addresses === addr)
                const times = addrPayTxs.map(tx=>tx.blockTime)
                await dbs.get(address).dexie.sendPartners.put({
                    address: addr,
                    value: addrPayTxs.map(tx=>tx.value).reduce((sum,v)=>sum+v),
                    count: addrPayTxs.length,
                    //firsted: addrPayTxs.reduce((a,b)=>Math.min(a.blockTime, b.blockTime)),
                    //lasted: addrPayTxs.reduce((a,b)=>Math.max(a.blockTime, b.blockTime)),
                    firsted: times.reduce((a,b)=>Math.min(a,b)),
                    lasted: times.reduce((a,b)=>Math.max(a,b)),
                })
            }
            for (const addr of receiveAddrs.values()) {
                const addrTxs = txs.filter(tx=>!tx.isPay && tx.addresses === addr)
                const times = addrTxs.map(tx=>tx.blockTime)
                await dbs.get(address).dexie.receivePartners.put({
                    address: addr,
                    value: addrTxs.map(tx=>tx.value).reduce((sum,v)=>sum+v),
                    count: addrTxs.length,
                    //firsted: addrTxs.reduce((a,b)=>Math.min(a.blockTime, b.blockTime)),
                    //lasted: addrTxs.reduce((a,b)=>Math.max(a.blockTime, b.blockTime)),
                    firsted: times.reduce((a,b)=>Math.min(a, b)),
                    lasted: times.reduce((a,b)=>Math.max(a, b)),
                })
            }
        }
    });
    async function debug() {
        const address = document.getElementById('address').value
        if (!address) { return }
        const options = {}
        //let lastBlockHeight = -1
        //let lastTxId = -1
        let balance = -1
        let totalReceived = -1
        let totalSent = -1
        let unconfirmedBalance = -1
        let unconfirmedTxs = -1
        //let newFees = 0
        //let sendCount = 0
        //let receiveCount = 0
        //let sendAddressCount = 0
        //let receiveAddressCount = 0
        //const res = await trezor.address(address, options)
        //console.debug(res.next())
        for await (const res of trezor.address(address, options)) {
        //for (const res of await trezor.address(address, options)) {
            balance = res.balance
            totalReceived = res.totalReceived 
            totalSent = res.totalSent 
            unconfirmedBalance = res.unconfirmedBalance 
            unconfirmedTxs = res.unconfirmedTxs 
            break
        }
        const txs = await dbs.get(address).dexie.transactions.toArray()
        console.debug(txs)
        const count = txs.length
        const fee = txs.map(tx=>parseInt(tx.fee)).reduce((sum,v)=>sum+v)
        console.debug(count, fee, (fee*(0.1**8)))
        const lastBlockTime = txs.map(tx=>tx.blockTime).reduce((a,b)=>Math.max(a, b))
        console.debug(lastBlockTime)
        const lastTx = txs.filter(tx=>tx.blockTime === lastBlockTime)[0]
        console.debug(lastTx)
        const lastBlockHeight = lastTx.blockHeight
        const lastTxId = lastTx.txid

        const payTxs = txs.filter(tx=>tx.isPay)
        const receiveTxs = txs.filter(tx=>!tx.isPay)
        const payAddrs = new Set(payTxs.map(tx=>tx.addresses))
        const receiveAddrs = new Set(receiveTxs.map(tx=>tx.addresses))
        const record = {
            id: 1,
            count: count,
            lastBlockHeight: lastBlockHeight,
            lastTxId: lastTxId,
            sendValue: totalSent,
            receiveValue: totalReceived,
            balance: balance,
            fee: fee,
            unconfirmedBalance: unconfirmedBalance,
            unconfirmedTxs: unconfirmedTxs,
            sendCount: sendCount,
            receiveCount: receiveCount,
            sendAddressCount: payAddrs.size,
            receiveAddressCount: receiveAddrs.size,
        }
        await dbs.get(address).dexie.last.put(record)
        for (const addr of payAddrs.values()) {
            const addrPayTxs = txs.filter(tx=>tx.isPay && tx.addresses === addr)
            await dbs.get(address).dexie.sendPartners.put({
                address: addr,
                value: addrPayTxs.reduce((sum,v)=>sum+v),
                count: addrPayTxs.length,
                firsted: addrPayTxs.reduce((a,b)=>Math.min(a.blockTime, b.blockTime)),
                lasted: addrPayTxs.reduce((a,b)=>Math.max(a.blockTime, b.blockTime)),
            })
        }
        for (const addr of receiveAddrs.values()) {
            const addrTxs = txs.filter(tx=>!tx.isPay && tx.addresses === addr)
            await dbs.get(address).dexie.receivePartners.put({
                address: addr,
                value: addrTxs.reduce((sum,v)=>sum+v),
                count: addrTxs.length,
                firsted: addrTxs.reduce((a,b)=>Math.min(a.blockTime, b.blockTime)),
                lasted: addrTxs.reduce((a,b)=>Math.max(a.blockTime, b.blockTime)),
            })
        }

        //console.debug(await trezor.address(address, options))
        /*
        for await (const res of trezor.address(address, options)) {
            balance = res.balance
            totalReceived = res.totalReceived 
            totalSent = res.totalSent 
            unconfirmedBalance = res.unconfirmedBalance 
            unconfirmedTxs = res.unconfirmedTxs 
            break
        }
        const txs = await dbs.get(address).dexie.transactions.toArray()
        const count = txs.length
        const fee = txs.map(tx=>tx.fee).reduce((sum,v)=>sum+v)
        const lastBlockTime = txs.reduce((a,b)=>Math.max(a.blockTime, b.blockTime))
        const lastBlockHeight = txs.filter(tx=>tx.blockTime === lastBlockTime)[0].blockHeight
        const lastTxId = txs.filter(tx=>tx.blockTime === lastBlockTime)[0].txid

        const payTxs = txs.filter(tx=>tx.isPay)
        const receiveTxs = txs.filter(tx=>!tx.isPay)
        const payAddrs = new Set(payTxs.map(tx=>tx.addresses))
        const receiveAddrs = new Set(receiveTxs.map(tx=>tx.addresses))
        const record = {
            id: 1,
            count: count,
            lastBlockHeight: lastBlockHeight,
            lastTxId: lastTxId,
            sendValue: totalSent,
            receiveValue: totalReceived,
            balance: balance,
            fee: fee,
            unconfirmedBalance: unconfirmedBalance,
            unconfirmedTxs: unconfirmedTxs,
            sendCount: sendCount,
            receiveCount: receiveCount,
            sendAddressCount: payAddrs.size,
            receiveAddressCount: receiveAddrs.size,
        }
        await dbs.get(address).dexie.last.put(record)
        for (const addr of payAddrs.values()) {
            const addrPayTxs = txs.filter(tx=>tx.isPay && tx.addresses === addr)
            await dbs.get(address).dexie.sendPartners.put({
                address: addr,
                value: addrPayTxs.reduce((sum,v)=>sum+v),
                count: addrPayTxs.length,
                firsted: addrPayTxs.reduce((a,b)=>Math.min(a.blockTime, b.blockTime)),
                lasted: addrPayTxs.reduce((a,b)=>Math.max(a.blockTime, b.blockTime)),
            })
        }
        for (const addr of receiveAddrs.values()) {
            const addrTxs = txs.filter(tx=>!tx.isPay && tx.addresses === addr)
            await dbs.get(address).dexie.receivePartners.put({
                address: addr,
                value: addrTxs.reduce((sum,v)=>sum+v),
                count: addrTxs.length,
                firsted: addrTxs.reduce((a,b)=>Math.min(a.blockTime, b.blockTime)),
                lasted: addrTxs.reduce((a,b)=>Math.max(a.blockTime, b.blockTime)),
            })
        }
        */
    }
    async function init(address=null) {
        if (window.hasOwnProperty('mpurse')) {
            const addr  = address || await window.mpurse.getAddress()
            if (!dbs.has(addr)) {
                dbs.set(addr, new MonaTransactionDb(addr))
                console.debug(addr)
                console.debug(dbs.get(addr))
            }
            document.getElementById('address').value = addr
            document.getElementById('get-transaction').dispatchEvent(new Event('click'))
        }
    }
    document.addEventListener('mastodon_redirect_approved', async(event) => {
        console.debug('===== mastodon_redirect_approved =====')
        console.debug(event.detail)
        // actionを指定したときの入力と出力を表示する
        for (let i=0; i<event.detail.actions.length; i++) {
            console.debug(event.detail.actions[i], (event.detail.params) ? event.detail.params[i] : null, event.detail.results[i])
            console.debug(`----- ${event.detail.actions[i]} -----`)
            console.debug((event.detail.params) ? event.detail.params[i] : null)
            console.debug(event.detail.results[i])
        }
        // 認証リダイレクトで許可されたあとアクセストークンを生成して作成したclientを使ってAPIを発行する
        //const res = event.detail.client.toot(JSON.parse(event.detail.params[0]))
        // 独自処理（）
        for (let i=0; i<event.detail.actions.length; i++) {
            if ('accounts' == event.detail.actions[i]) {
                const gen = new MastodonProfileGenerator(event.detail.domain)
                document.getElementById('export-mastodon').innerHTML = gen.generate(event.detail.results[i])
            }
            else if ('status' == event.detail.actions[i]) {
                const html = new Comment().mastodonResToComment(event.detail.results[i])
                const comment = document.querySelector(`mention-section`).shadowRoot.querySelector(`#web-mention-comment`)
                comment.innerHTML = html + comment.innerHTML
            }
        }
    });
    document.addEventListener('mastodon_redirect_rejected', async(event) => {
        console.debug('認証エラーです。認証を拒否しました。')
        console.debug(event.detail.error)
        console.debug(event.detail.error_description)
        Toaster.toast('キャンセルしました')
    });
    /*
    document.getElementById('get-misskey-account-info').addEventListener('click', async(event) => {
        const domain = document.getElementById('misskey-instance').value
        if ('' == domain.trim()) { Toaster.toast(`インスタンスのドメイン名またはURLを入力してください。`, true); return; }
        if (await MisskeyInstance.isExist(domain)) {
            console.debug('指定したインスタンスは存在する')
            const authorizer = await MisskeyAuthorizer.get(domain, 'read:account')
            console.debug(authorizer)
            await authorizer.authorize(['i'], null)
        } else {
            Toaster.toast('指定したインスタンスは存在しません。', true)
        }
    });
    */
    document.addEventListener('misskey_redirect_approved', async(event) => {
        console.debug('===== misskey_redirect_approved =====')
        console.debug(event.detail)
        // actionを指定したときの入力と出力を表示する
        for (let i=0; i<event.detail.actions.length; i++) {
            console.debug(event.detail.actions[i], (event.detail.params) ? event.detail.params[i] : null, event.detail.results[i])
            console.debug(`----- ${event.detail.actions[i]} -----`)
            console.debug((event.detail.params) ? event.detail.params[i] : null)
            console.debug(event.detail.results[i])
        }
        // 認証リダイレクトで許可されたあとアクセストークンを生成して作成したclientを使ってAPIを発行する
        //const res = event.detail.client.toot(JSON.parse(event.detail.params[0]))
        // 独自処理
        for (let i=0; i<event.detail.actions.length; i++) {
            if ('i' == event.detail.actions[i]) {
                const gen = new MisskeyProfileGenerator(event.detail.domain)
                document.getElementById('export-misskey').innerHTML = gen.generate(event.detail.results[i])
            }
            else if ('note' == event.detail.actions[i]) {
                const html = new Comment().misskeyResToComment(event.detail.results[i].createdNote, event.detail.domain)
                const comment = document.querySelector(`mention-section`).shadowRoot.querySelector(`#web-mention-comment`)
                comment.innerHTML = html + comment.innerHTML
            }
        }
    });
    document.addEventListener('misskey_redirect_rejected', async(event) => {
        console.debug('認証エラーです。認証を拒否しました。')
        console.debug(event.detail.error)
        console.debug(event.detail.error_description)
        Toaster.toast('キャンセルしました')
    });
    init()
    // mpurseアドレスのプロフィール情報を取得する
    //initForm()
    // リダイレクト認証後
    const reciverMastodon = new MastodonRedirectCallbackReciver()
    await reciverMastodon.recive()
    const reciverMisskey = new MisskeyRedirectCallbackReciver()
    await reciverMisskey.recive()
});

