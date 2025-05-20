import { SealClient, SessionKey, NoAccessError, EncryptedObject } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import React from 'react';

export type MoveCallConstructor = (tx: Transaction, id: string) => void;

export const downloadAndDecrypt = async (
  blobId: string,
  sessionKey: SessionKey,
  suiClient: SuiClient,
  sealClient: SealClient,
  moveCallConstructor: (tx: Transaction, id: string) => void,
//   setError: (error: string | null) => void,
//   setDecryptedFileUrls: (urls: string[]) => void,
//   setIsDialogOpen: (open: boolean) => void,
//   setReloadKey: (updater: (prev: number) => number) => void,
) => {
  const aggregators = ['https://aggregator.walrus-testnet.walrus.space', 'https://wal-aggregator-testnet.staketab.org', 'https://walrus-testnet-aggregator.redundex.com', 'https://walrus-testnet-aggregator.nodes.guru', 'https://aggregator.walrus.banansen.dev', 'https://walrus-testnet-aggregator.everstake.one'];
  const randomAggregator = aggregators[Math.floor(Math.random() * aggregators.length)];
  const aggregatorUrl = `${randomAggregator}/v1/blobs/${blobId}`;

  let encryptedData: ArrayBuffer;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(aggregatorUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error('Failed to fetch blob');
    }

    encryptedData = await response.arrayBuffer();
    console.log(encryptedData);
  } catch (err) {
    console.error(`Blob ${blobId} cannot be retrieved from Walrus`, err);
    // setError('Unable to download the file. Try again later.');
    return;
  }

  const id = EncryptedObject.parse(new Uint8Array(encryptedData)).id;
  console.log(id);
  const tx = new Transaction();
  moveCallConstructor(tx, id);
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  try {
    await sealClient.fetchKeys({ ids: [id], txBytes, sessionKey, threshold: 2 });
  } catch (err) {
    console.error('Key fetch error', err);
    // setError(err instanceof NoAccessError ? 'No access to decryption keys' : 'Decryption failed. Try again.');
    return;
  }

  try {
    console.log("seal decrypt");
    const decrypted = await sealClient.decrypt({
      data: new Uint8Array(encryptedData),
      sessionKey,
      txBytes,
    });
    const decryptedText = new TextDecoder().decode(decrypted);
    console.log(decryptedText)
    // const blob = new Blob([decrypted], { type: 'image/jpg' });
    // setDecryptedFileUrls([URL.createObjectURL(blob)]);
    // setIsDialogOpen(true);
    // setReloadKey((prev) => prev + 1);
  } catch (err) {
    console.error('Decryption error', err);
    // setError(err instanceof NoAccessError ? 'No access to decryption keys' : 'Failed to decrypt the file.');
  }
};

export const getObjectExplorerLink = (id: string): React.ReactElement => {
  return React.createElement(
    'a',
    {
      href: `https://testnet.suivision.xyz/object/${id}`,
      target: '_blank',
      rel: 'noopener noreferrer',
      style: { textDecoration: 'underline' },
    },
    id.slice(0, 10) + '...',
  );
};
