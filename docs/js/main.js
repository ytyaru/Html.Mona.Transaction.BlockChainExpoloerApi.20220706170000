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
        const address = document.getElementById('address').value
        if (!address) { return }
        console.debug(address)
        console.debug(dbs)
        console.debug(dbs.get(address))
        console.debug(dbs.get(address).dexie)
        console.debug(dbs.get(address).dexie.last)
        const last = await dbs.get(address).dexie.last.get(1)
        console.debug(last)
        const options = {}
        if (last) { // 前回データがあるなら取得開始位置としてブロックの高さを渡す（これ以降のデータしか取得しない）
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
        let sendCount = (last) ? last.sendCount : 0
        let receiveCount = (last) ? last.receiveCount : 0
        let sendAddressCount = 0
        let receiveAddressCount = 0
        let lastFirsted = 0
        let lastLasted = 0
        document.getElementById(`progress`).style.display = 'inline'
        document.getElementById(`progress-rate`).style.display = 'inline'
        for await (const res of trezor.address(address, options)) {
            //debugLast(res)
            if (!res) { break }
            if (!res.hasOwnProperty('txids')) { break }
            console.debug(res)
            //window.getComputedStyle(document.getElementById(`progress`));
            document.getElementById(`progress`).max = res.txids.length
            document.getElementById(`progress`).value = 0
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
                if (-1 === lastTxId && 0 < tx.confirmations) { // 最新の承認済み取引なら
                    lastBlockHeight = tx.blockHeight 
                    lastTxId = tx.txid
                    balance = res.balance
                    totalReceived = res.totalReceived 
                    totalSent = res.totalSent 
                    unconfirmedBalance = res.unconfirmedBalance 
                    unconfirmedTxs = res.unconfirmedTxs 
                    lastLasted = tx.blockTime
                }
                if (i === newTxIds.length-1) { // 最後なら
                    lastFirsted = tx.blockTime
                }
                const fee = parseInt(tx.fees)
                newFees += fee
                console.debug(tx)
                const isPay = tx.vin.some(v=>v.addresses.includes(address))
                const value = (isPay) ? parseInt(tx.vin[tx.vin.findIndex(v=>v.addresses.includes(address))].value) - parseInt(tx.vout[tx.vout.findIndex(v=>v.addresses.includes(address))].value) : parseInt(tx.vout[tx.vout.findIndex(v=>v.addresses.includes(address))].value)
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
                    txid: tx.txid,
                    isPay: isPay,
                    addresses: Array.from(addrs).join(','),
                    value: value,
                    fee: fee,
                    confirmations: tx.confirmations,
                    blockTime: tx.blockTime,
                    blockHeight: tx.blockHeight,
                })
                // 進捗表示
                const progressRate = (((i+1)/newTxIds.length)*100).toFixed(2)
                console.debug(`${progressRate}% ${i+1}/${newTxIds.length}`)
                console.debug(dbs.get(address).dexie.transactions.get(tx.txid))
                //document.getElementById(`progress`).value = document.getElementById(`progress`).value + 1
                //document.getElementById(`progress`).value += 1
                document.getElementById(`progress`).value++
                console.debug(document.getElementById(`progress`).value)
                document.getElementById(`progress-rate`).innerText = `${progressRate}% ${i+1}/${newTxIds.length}`
                console.debug()
            }
            // 未承認取引データDB更新
            const txs = await dbs.get(address).dexie.transactions.toArray()
            /*
            console.debug(txs)
            const notConfirmTxs = txs.filter(tx=>0===tx.confirmations).map(tx=>tx.txid)
            if (last && 0 < notConfirmTxs.length) { lastLasted = last.lasted }
            for (const txid of notConfirmTxs) {
                const tx = await trezor.tx(txid)
                if (0 === tx.confirmations) { continue }
                if (lastLasted < tx.blockTime) { // 既存DB最終日時より新しいなら
                    lastLasted = tx.blockTime
                    lastBlockHeight = tx.blockHeight
                    lastTxId = tx.txid
                }
                //lastLasted = Math.max(lastLasted, tx.blockTime)
                const old = dbs.get(address).dexie.transactions.get(txid)
                dbs.get(address).dexie.transactions.put({
                    txid: old.txid,
                    isPay: old.isPay,
                    addresses: old.addresses,
                    value: old.value,
                    fee: old.fee,
                    confirmations: tx.confirmations, // 更新
                    blockTime: tx.blockTime,         // 更新
                    blockHeight: tx.blockHeight,     // 更新
                })
            }
            if (0 === newTxIds.length && last && 0 < notConfirmTxs.length && -1 < lastTxId)  { // 未承認取引データだけ更新があった
                await dbs.get(address).dexie.last.put({
                    id: last.id,
                    count: last.count,
                    lastBlockHeight: lastBlockHeight, // 更新（次回更新に影響する）
                    lastTxId: lastTxId, // 更新（次回更新に影響する）
                    sendValue: parseInt(totalSent), // 更新
                    receiveValue: parseInt(totalReceived), // 更新
                    balance: parseInt(balance), // 更新
                    fee: last.fee,
                    unconfirmedBalance: parseInt(unconfirmedBalance), // 更新
                    unconfirmedTxs: parseInt(unconfirmedTxs), // 更新
                    sendCount: last.sendCount,
                    receiveCount: last.receiveCount,
                    sendAddressCount: last.sendAddressCount,
                    receiveAddressCount: last.receiveAddressCount,
                    bothAddressCount: last.bothAddressCount,
                    firsted: last.firsted,
                    lasted: lastLasted, // 更新
                })
            }
            */
            if (newTxIds.length < 1 || -1 == lastTxId) { break }
            console.debug('******************* lastテーブル更新 *******************')
            const count = ((last) ? last.count : 0) + newTxIds.length
            const fee = ((last) ? last.fee : 0) + newFees
            //const txs = await dbs.get(address).dexie.transactions.toArray()
            //txs = await dbs.get(address).dexie.transactions.toArray()
            console.debug(txs)
            const payTxs = txs.filter(tx=>tx.isPay)
            const receiveTxs = txs.filter(tx=>!tx.isPay)
            const payAddrs = new Set(payTxs.map(tx=>tx.addresses))
            const receiveAddrs = new Set(receiveTxs.map(tx=>tx.addresses))
            const payAddrsAry = Array.from(payAddrs)
            const receiveAddrsAry = Array.from(receiveAddrs)
            const bothAddrsAry = payAddrsAry.filter(addr=>receiveAddrsAry.includes(addr))
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
                bothAddressCount: bothAddrsAry.length,
                firsted: (last) ? last.firsted : lastFirsted,
                lasted: lastLasted,
            }
            await dbs.get(address).dexie.last.put(record)
            for (const addr of payAddrs.values()) {
                const addrPayTxs = txs.filter(tx=>tx.isPay && tx.addresses === addr)
                const times = addrPayTxs.map(tx=>tx.blockTime)
                await dbs.get(address).dexie.sendPartners.put({
                    address: addr,
                    value: addrPayTxs.map(tx=>tx.value-tx.fee).reduce((sum,v)=>sum+v),
                    count: addrPayTxs.length,
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
                    firsted: times.reduce((a,b)=>Math.min(a, b)),
                    lasted: times.reduce((a,b)=>Math.max(a, b)),
                })
            }
        }
        const viewer = new MonaTransactionViewerFromDb(address, dbs)
        document.getElementById(`export-transaction`).innerHTML = await viewer.generate()
        document.getElementById(`progress`).style.display = 'none'
        document.getElementById(`progress-rate`).style.display = 'none'
    });
    async function debugLast(res) {
        const address = document.getElementById('address').value
        const txs = await dbs.get(address).dexie.transactions.toArray()
        const cnfTxs = txs.filter(tx=>0<tx.confirmations)
        const maxBlockHeight = cnfTxs.map(tx=>tx.blockHeight).reduce((sum,v)=>Math.max(sum,v))
        const blockTimes = cnfTxs.map(tx=>tx.blockTime)
        const maxBlockTime = blockTimes.reduce((sum,v)=>Math.max(sum,v))
        const minBlockTime = blockTimes.reduce((sum,v)=>Math.min(sum,v))
        const lastTxId = cnfTxs.find(tx=>tx.blockTime===maxBlockTime).txid
        const payTxs = txs.filter(tx=>tx.isPay)
        const receiveTxs = txs.filter(tx=>!tx.isPay)
        const payAddrs = new Set(payTxs.map(tx=>tx.addresses))
        const receiveAddrs = new Set(receiveTxs.map(tx=>tx.addresses))
        const payAddrsAry = Array.from(payAddrs)
        const receiveAddrsAry = Array.from(receiveAddrs)
        const bothAddrsAry = payAddrsAry.filter(addr=>receiveAddrsAry.includes(addr))
        const fee = txs.filter(tx=>tx.isPay).map(tx=>tx.fee).reduce((sum,v)=>sum+v)
        const record = {
            id: 1,
            //count: txs.length,
            count: res.txs,
            lastBlockHeight: maxBlockHeight,
            lastTxId: lastTxId,
            sendValue: parseInt(res.totalSent),
            receiveValue: parseInt(res.totalReceived),
            balance: parseInt(res.balance),
            //sendValue: parseInt(totalSent),
            //receiveValue: parseInt(totalReceived),
            //balance: parseInt(balance),
            fee: fee,
            unconfirmedBalance: parseInt(res.unconfirmedBalance),
            unconfirmedTxs: res.unconfirmedTxs,
            sendCount: payTxs.length,
            receiveCount: receiveTxs.length,
            sendAddressCount: payAddrs.size,
            receiveAddressCount: receiveAddrs.size,
            bothAddressCount: bothAddrsAry.length,
            firsted: minBlockTime,
            lasted: maxBlockTime,
        }
        await dbs.get(address).dexie.last.put(record)
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

