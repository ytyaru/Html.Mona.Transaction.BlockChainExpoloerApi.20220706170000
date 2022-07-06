class MonaTransactionDb {
    /*
    create() {
        this.dexie = new Dexie(`MyTransactionDb`);
        this.dexie.version(1).stores({
            addresses: `++id`,
            sendPartners: `++id`,
            receivePartners: `++id`,
            transactions:  `++id`,
        });
        this.dexie.version(1).stores({
            addresses: `address`,
            sendPartners: `[my+partner]`,
            receivePartners: `[my+partner]`,
            transactions:  `[my+txid]`,
        });
        this.dexie.version(1).stores({
            addresses: `++id`,
            sendPartners: `[my+partner]`, // 複合プライマリキー address.idとpartnerアドレス
            receivePartners: `[my+partner]`,
            transactions:  `[my+txid]`,
        });
    }
    */
    constructor(address) {
        this.create(address)
    }
    create(address) { // address:自分のアドレス
        this.dexie = new Dexie(`${address}`); // 自分のアドレスひとつごとにDBを作成する。テーブル結合不要になる。
        this.dexie.version(1).stores({
            last: `++id`
            sendPartners: `address`,
            receivePartners: `address`,
            transactions:  `txid`,
        });
    }
    async addMyAddress(address) {
        this.dexie.addresses.put({address:address})
    }
}
