import PQueue from "p-queue";

export async function processBatch(items, processFn) {
  const results = [];
  const failed = [];

  const queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 40 });

  for (const item of items) {
    queue.add(async () => {
      try {
        const result = await processFn(item);
        results.push(result);
      } catch (error) {
        failed.push({
          item,
          error: error.message,
        });
      }
    });
  }

  await queue.onIdle();

  return { results, failed };
}

export async function processBatchInChunks(
  items,
  processFn,
  chunkSize = 50,
  onProgress = null
) {
  const allResults = [];
  const allFailed = [];
  let processedCount = 0;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    const chunkQueue = new PQueue({
      concurrency: 1,
      interval: 1000,
      intervalCap: 40,
    });

    for (const item of chunk) {
      chunkQueue.add(async () => {
        try {
          const result = await processFn(item);
          allResults.push(result);
        } catch (error) {
          allFailed.push({
            item,
            error: error.message,
          });
        }

        processedCount++;
        if (onProgress) {
          onProgress({ current: processedCount, total: items.length });
        }
      });
    }

    await chunkQueue.onIdle();
  }

  return { results: allResults, failed: allFailed };
}
