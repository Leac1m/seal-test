'use client';

import { useState } from 'react';
import { ConnectButton, useCurrentWallet } from '@mysten/dapp-kit';
import {
    useCurrentAccount,
    useSignPersonalMessage,
    useSuiClient,
} from '@mysten/dapp-kit';
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { useNetworkVariable } from '@/utils/networkConfig';
import { fromHex, SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';
import { SealClient, SessionKey } from '@mysten/seal';
import '@mysten/dapp-kit/dist/index.css';
import { MoveCallConstructor, downloadAndDecrypt } from '@/utils/decrypt';

const TTL_MIN = 10;

export default function DecryptPage() {
    const suiClient = useSuiClient();

    const [inputValue, setInputValue] = useState('p6v9h6XiA5yJwD0_pjr-R-M9NWFEVNdPkJ2XAiS2NJo');
    const packageId = useNetworkVariable('packageId');

    const [currentSessionKey, setCurrentSessionKey] = useState<SessionKey | null>(null);
    const { mutate: signPersonalMessage } = useSignPersonalMessage();
    const currentAccount = useCurrentAccount();
    const serverObjectIds = ["0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"]

    const client = new SealClient({
        suiClient,
        serverConfigs: serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    })),
        verifyKeyServers: false,
    });
    const wallet = useCurrentWallet();

    function constructMoveCall(
        packageId: string,
    ): MoveCallConstructor {
        return (tx: Transaction, id: string) => {
            tx.moveCall({
                target: `${packageId}::smc::seal_approve`,
                arguments: [
                    tx.pure.vector('u8', fromHex(id)),
                    tx.pure.u64(1),
                ],
            });
        };
    }


    const handleDecrypt = () => {
        if (!wallet) {
            alert('Connect your wallet first.');
            return;
        }
        console.log('Decrypting:', inputValue);
        if (
            currentSessionKey &&
            !currentSessionKey.isExpired() &&
            currentSessionKey.getAddress() === currentAccount?.address!
        ) {
            const moveCallConstructor = constructMoveCall(
                packageId,
            );
            downloadAndDecrypt(
                inputValue,
                currentSessionKey,
                suiClient,
                client,
                moveCallConstructor
            );
            return;
        }
        setCurrentSessionKey(null);
        const sessionKey = new SessionKey({
            address: currentAccount?.address!,
            packageId,
            ttlMin: TTL_MIN,
        });
        console.log(sessionKey);

        try {
            signPersonalMessage(
                {
                    message: sessionKey.getPersonalMessage(),
                },
                {
                    onSuccess: async (result) => {
                        await sessionKey.setPersonalMessageSignature(result.signature);
                        const moveCallConstructor = await constructMoveCall(
                            packageId,
                        );
                        await downloadAndDecrypt(
                            inputValue,
                            sessionKey,
                            suiClient,
                            client,
                            moveCallConstructor
                        );
                        setCurrentSessionKey(sessionKey);
                    },
                },
            );
        } catch (error: any) {
            console.error('Error:', error);
        }


    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
            <div className="absolute top-6 right-6">
                <ConnectButton />
            </div>

            {/* Decrypt Card */}
            <div className="bg-gray-800 p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-700">
                <h1 className="text-2xl font-bold text-center mb-6 text-gray-100">Decrypt</h1>

                <input
                    type="text"
                    placeholder="Enter encrypted text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-400"
                />

                <button
                    onClick={handleDecrypt}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold transition"
                >
                    Decrypt
                </button>
            </div>
        </div>
    );
};