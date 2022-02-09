import { Contract, providers } from 'ethers';
import abi from './factory.abi.json';
import yargs, { conflicts } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { writeFile } from 'fs/promises';

type Config = {
  factories: string[];
  rpcUrl: string;
};

const config: Config = {
  factories: ['0x68a384d826d3678f78bb9fb1533c7e9577dacc0e'],
  rpcUrl: 'wss://moonbeam.api.onfinality.io/public-ws',
};

const listen = async () => {
  console.log('Watching for PairCreated event');
  const provider = new providers.WebSocketProvider(config.rpcUrl);
  const factories = config.factories.map((t) => new Contract(t, abi, provider));
  factories.forEach((factory) => {
    factory.on('PairCreated', (ev) => {
      console.log(
        'PairCreated by',
        factory.address,
        ev.transactionHash,
        ev.args,
      );
      console.log(ev);
    });
  });
  provider.on('block', async (n) => {
    await writeFile('.block', '' + n);
  });
};

const crawl = async (startBlock: number) => {
  console.log('Crawl event from', startBlock);
  const provider = new providers.WebSocketProvider(config.rpcUrl);
  const factories = config.factories.map((t) => new Contract(t, abi, provider));

  const now = await provider.getBlockNumber();
  const chunkSize = 500;
  const nChunk = Math.ceil((now - startBlock) / chunkSize);

  for (let i = 0; i < nChunk; i++) {
    const start = startBlock + i * chunkSize;
    const end = Math.min(start + chunkSize, now);
    const p$ = factories.map(async (factory) => {
      const ev = await factory.queryFilter(
        factory.filters.PairCreated(),
        start,
        end,
      );
      ev.forEach((e) => {
        console.log(
          'Pair created by',
          factory.address,
          e.transactionHash,
          e.args,
        );
      });
    });

    await Promise.all(p$);
  }
};

yargs(hideBin(process.argv))
  .command<{ startBlock: number }>(
    'crawl [startBlock]',
    'Crawl PairCreated from block',
    () => {},
    async (cmd) => {
      crawl(cmd.startBlock);
    },
  )
  .command('watch', 'Watch for new pair created', () => {}, listen)
  .help().argv;
