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
        const last = dbs.get(address).last.toArray()
        const options = {}
        if (0 < last.length) { // 前回データがあるなら一旦それを表示する
            options.from = last.last_block_height
        }
        // 最新データを取得する
        const res = trezor.address(address, options)
        if (0 < last.length) { // 前回データがあるなら最新データからそれ以前のデータを削除する
            const last_txid_idx = res.txids.findIndex(last.last_txid)
            const newTxIds = res.txids.slice(0, last_txid_idx)
            const addrs = new Set([...tx.vin.map(v=>v.addresses), ...tx.vout.map(v=>v.addresses)])
            addrs.delete(address)
            for (let i=0; i<newTxIds.length; i++) {
                const tx = await trezor.tx(newTxIds[i])
                const isPay = tx.vin.some(in=>in.addresses.includes(address))
                const value = (isPay) ? tx.vin[tx.vin.findIndex(v=>v.addresses.includes(address))].value : 
                if (0 === tx.confirmations) { console.error('未承認トランザクションです！', tx) }
                dbs.get(address).transactions.add({
                    txid: txid[i],
                    isPay: isPay ,
                    addresses: addrs.values().join(','),
                    value: tx.value,
                    fee: tx.fees,
                    blockTime: tx.blockTime,
                    blockHeight: tx.blockHeight,
                })
                await sleep(1000)
                // 進捗表示
                console.debug(`${((i+1)/newTxIds.length).toFixed(2)}% ${i+1}/${newTxIds.length}`)
            }
        }
        // 最新データが上限数存在するなら（続きのデータがあるなら）取得する（上記をループ）

        // 最新データを表示する
        /*
        const address = document.getElementById('address').value
        if (address) {
            const client = new MonaTransactionClient()
            const json = await client.get(address)
            document.getElementById('response').value = JSON.stringify(json)
            console.debug(json)
            const gen = new MonaTransactionViewer(address)
            document.getElementById('export-transaction').innerHTML = await gen.generate(json)
        }
        */
    });
    async function init(address=null) {
        if (window.hasOwnProperty('mpurse')) {
            const addr  = address || await window.mpurse.getAddress()
            if (!dbs.has(addr)) {
                dbs.set(addr, new MonaTransactionDb(addr))
                console.debug(addr)
                console.debug(dbs.get(addr))
            }
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

