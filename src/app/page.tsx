'use client';

import { useState } from 'react';
import { ConnectButton, useCurrentWallet } from '@mysten/dapp-kit';
import '@mysten/dapp-kit/dist/index.css';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useNetworkVariable } from '@/utils/networkConfig';
import { fromHex, toHex } from '@mysten/sui/utils';
import { getAllowlistedKeyServers, SealClient } from '@mysten/seal';

export type Data = {
  status: string;
  blobId: string;
  endEpoch: string;
  suiRefType: string;
  suiRef: string;
  suiBaseUrl: string;
  blobUrl: string;
  suiUrl: string;
  isImage: string;
};


type WalrusService = {
  id: string;
  name: string;
  publisherUrl: string;
  aggregatorUrl: string;
};

export default function Home() {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [info, setInfo] = useState<Data | null>(null);
  const { currentWallet, connectionStatus } = useCurrentWallet();

  const [selectedService, setSelectedService] = useState<string>('service1');

  const SUI_VIEW_TX_URL = `https://suiscan.xyz/testnet/tx`;
  const SUI_VIEW_OBJECT_URL = `https://suiscan.xyz/testnet/object`;

  const NUM_EPOCH = 1;
  const packageId = useNetworkVariable('packageId');
  const suiClient = useSuiClient();
  const client = new SealClient({
    suiClient,
    serverObjectIds: getAllowlistedKeyServers('testnet'),
    verifyKeyServers: false,
  });

  const services: WalrusService[] = [
    {
      id: 'service1',
      name: 'walrus.space',
      publisherUrl: 'https://publisher.walrus-testnet.walrus.space',
      aggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
    },
    {
      id: 'service2',
      name: 'staketab.org',
      publisherUrl: 'https://wal-publisher-testnet.staketab.org',
      aggregatorUrl: 'https://wal-aggregator-testnet.staketab.org',
    },
    {
      id: 'service3',
      name: 'redundex.com',
      publisherUrl: 'https://walrus-testnet-publisher.redundex.com',
      aggregatorUrl: 'https://walrus-testnet-aggregator.redundex.com',
    },
    {
      id: 'service4',
      name: 'nodes.guru',
      publisherUrl: 'https://walrus-testnet-publisher.nodes.guru',
      aggregatorUrl: 'https://walrus-testnet-aggregator.nodes.guru',
    },
    {
      id: 'service5',
      name: 'banansen.dev',
      publisherUrl: 'https://publisher.walrus.banansen.dev',
      aggregatorUrl: 'https://aggregator.walrus.banansen.dev',
    },
    {
      id: 'service6',
      name: 'everstake.one',
      publisherUrl: 'ttps://walrus-testnet-publisher.everstake.one',
      aggregatorUrl: 'https://walrus-testnet-aggregator.everstake.one',
    },
  ];

  function getAggregatorUrl(path: string): string {
    const service = services.find((s) => s.id === selectedService);
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    return `${service?.aggregatorUrl}/v1/${cleanPath}`;
  }

  function getPublisherUrl(path: string): string {
    const service = services.find((s) => s.id === selectedService);
    console.log(service);
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    console.log(`${service?.publisherUrl}/v1/${cleanPath}`);
    // return `${service?.publisherUrl}/v1/${cleanPath}`;
    console.log(`${service?.publisherUrl}/v1/${cleanPath}`);
    return `${service?.publisherUrl}/v1/${cleanPath}`
  }

  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
        },
      }),
  });


  const storeBlob = (encryptedData: Uint8Array) => {
    return fetch(`${getPublisherUrl(`/v1/blobs?epochs=${NUM_EPOCH}`)}`, {
      method: 'PUT',
      body: encryptedData,
    }).then((response) => {
      if (response.status === 200) {
        return response.json().then((info) => {
          return { info };
        });
      } else {
        alert('Error publishing the blob on Walrus, please select a different Walrus service.');
        setIsUploading(false);
        throw new Error('Something went wrong when storing the blob!');
      }
    });
  };

  const displayUpload = (storage_info: any, media_type: any) => {
    let info;
    if ('alreadyCertified' in storage_info) {
      info = {
        status: 'Already certified',
        blobId: storage_info.alreadyCertified.blobId,
        endEpoch: storage_info.alreadyCertified.endEpoch,
        suiRefType: 'Previous Sui Certified Event',
        suiRef: storage_info.alreadyCertified.event.txDigest,
        suiBaseUrl: SUI_VIEW_TX_URL,
        blobUrl: getAggregatorUrl(`/v1/blobs/${storage_info.alreadyCertified.blobId}`),
        suiUrl: `${SUI_VIEW_OBJECT_URL}/${storage_info.alreadyCertified.event.txDigest}`,
        isImage: media_type.startsWith('image'),
      };
    } else if ('newlyCreated' in storage_info) {
      info = {
        status: 'Newly created',
        blobId: storage_info.newlyCreated.blobObject.blobId,
        endEpoch: storage_info.newlyCreated.blobObject.storage.endEpoch,
        suiRefType: 'Associated Sui Object',
        suiRef: storage_info.newlyCreated.blobObject.id,
        suiBaseUrl: SUI_VIEW_OBJECT_URL,
        blobUrl: getAggregatorUrl(`/v1/blobs/${storage_info.newlyCreated.blobObject.blobId}`),
        suiUrl: `${SUI_VIEW_OBJECT_URL}/${storage_info.newlyCreated.blobObject.id}`,
        isImage: media_type.startsWith('image'),
      };
    } else {
      throw Error('Unhandled successful response!');
    }
    console.log("info", info);
    setInfo(info);
  };

  const handleSubmit = async () => {
    console.log('Uploading...');
    setIsUploading(true);
    if (text) {
      try {
        const textBytes = new TextEncoder().encode(text)
        const nonce = crypto.getRandomValues(new Uint8Array(5));
        const policyObjectBytes = fromHex(currentWallet?.accounts[0].address!);
        const id = toHex(new Uint8Array([...policyObjectBytes, ...nonce]));
        console.log('Encrypting...', packageId);
        const { encryptedObject: encryptedBytes } = await client.encrypt({
          threshold: 2,
          packageId,
          id,
          data: textBytes,
        });

        console.log('Uploading to Walrus...');

        const storageInfo = await storeBlob(encryptedBytes);
        displayUpload(storageInfo.info, "text");
        console.log('Successfully uploaded to Walrus!');
        console.log(info);
        setIsUploading(false);
      } catch (error) {
        console.error(error);
      }

    }
    else {
      setIsUploading(false);

      alert('Please enter some text');
      return;
    }


  }

  const handleClick = () => {
    console.log('Input:', text);
    alert(`You entered: ${text}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 gap-4">
      <ConnectButton />

      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter something..."
        className="border border-gray-300 rounded px-4 py-2 w-64"
      />
      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        Submit
      </button>
    </main>
  );
}
