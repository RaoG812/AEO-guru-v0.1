// lib/clustering.ts
import { qdrant, COLLECTION } from "./qdrant";

export async function getProjectPoints(projectId: string) {
  const res = await qdrant.scroll(COLLECTION, {
    filter: {
      must: [
        { key: "projectId", match: { value: projectId } },
        { key: "type", match: { value: "page_section" } }
      ]
    },
    with_payload: true,
    with_vectors: true,
    limit: 10000
  });

  return res.points;
}

export type Cluster = {
  id: string;
  pointIds: string[];
};

export function naiveCluster(points: any[], maxClusterSize = 50): Cluster[] {
  // Dumb hackathon clustering: just bucket by URL and content similarity threshold.
  // You can replace this with K-means or use Qdrant's recommendations later.
  const clusters: Cluster[] = [];
  let clusterIdx = 0;

  for (const p of points) {
    const url = p.payload?.url as string;
    let cluster = clusters.find((c) =>
      c.id.startsWith(url)
    );
    if (!cluster) {
      cluster = { id: `${url}#c${clusterIdx++}`, pointIds: [] };
      clusters.push(cluster);
    }
    cluster.pointIds.push(p.id);
  }

  return clusters;
}
