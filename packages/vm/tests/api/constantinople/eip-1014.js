const tape = require('tape')
const BN = require('bn.js')
const VM = require('../../../dist/index').default
const { createAccount } = require('../utils')
const { keccak256 } = require('ethereumjs-util')

// Non-protected Create2Address generator. Does not check if buffers have the right padding. Returns a 32-byte buffer which contains the address.
function create2address(sourceAddress, codeHash, salt) {
    let rlp_proc_buffer = Buffer.from('ff', 'hex')
    let hashBuffer = Buffer.concat([rlp_proc_buffer, sourceAddress, salt, codeHash])
    return keccak256(hashBuffer).slice(12)
}

tape('Constantinople: EIP-1014 CREATE2 creates the right contract address', async (t) => {
    const caller = Buffer.from('00000000000000000000000000000000000000ee', 'hex')
    const addr = Buffer.from('00000000000000000000000000000000000000ff', 'hex')
    const key = new BN(0).toArrayLike(Buffer, 'be', 32)
    const vm = new VM({ chain: 'mainnet', hardfork: 'constantinople'},)
    const account = createAccount('0x00', '0x00')
    const code = "3460008080F560005260206000F3"
    const expectedReturnValue = new BN(0).toArrayLike(Buffer, 'be', 32)
    /*
      code:             remarks: (top of the stack is at the zero index)
        CALLVALUE
        PUSH1 0x00
        DUP1
        DUP1
        CREATE2         [0, 0, 0, CALLVALUE]
        PUSH1 0x00
        MSTORE          [0x00, <created address>]
        PUSH1 0x20
        PUSH1 0x00
        RETURN          [0x00, 0x20]
    */
    await vm.stateManager.putAccount(addr, account)
    await vm.stateManager.putContractCode(addr, Buffer.from(code, 'hex'))

    let codeHash = keccak256(Buffer.from(''))
    let sourceAddress = addr



    for (let value = 0; value <= 1000; value+=20) {
        let runCallArgs = {
            caller: caller,
            gasLimit: new BN(0xffffffffff),
            to: addr,
            value: new BN(value)
        }
        let hexString = value.toString(16);
        // pad string if necessary
        if (hexString.length % 2 != 0) {
            hexString = "0" + hexString
        }
        let valueBuffer = Buffer.from(hexString, 'hex')
        // pad buffer
        if (valueBuffer.length < 32) {
            let diff = 32 - valueBuffer.length 
            valueBuffer = Buffer.concat([Buffer.alloc(diff), valueBuffer])
        }
        let expectedAddress = create2address(sourceAddress, codeHash, valueBuffer)
        const res = await vm.runCall(runCallArgs)
        const executionReturnValue = res.execResult.returnValue.slice(12)
        if (!expectedAddress.equals(executionReturnValue)) {
            console.log('not equal')
            t.fail("contract address not equal")
        }
    }

    t.end()
})

