// lib/clustering.ts
import { getQdrantClient, COLLECTION } from "./qdrant";

export type ProjectPoint = {
  id: string | number;
  payload?: Record<string, any> | null;
  vector?: number[] | null;
  [key: string]: any;
};

export type Cluster = {
  id: string;
  pointIds: Array<string | number>;
  centroid?: number[];
};

function normalizeVector(
  vector: ProjectPoint["vector"] | Record<string, unknown> | null | undefined
): number[] | null {
  if (Array.isArray(vector)) {
    return vector as number[];
  }
  if (vector && typeof vector === "object") {
    const first = Object.values(vector)[0];
    if (Array.isArray(first)) {
      return first as number[];
    }
  }
  return null;
}

export async function getProjectPoints(projectId: string): Promise<ProjectPoint[]> {
  const qdrant = getQdrantClient();
  const res = await qdrant.scroll(COLLECTION, {
    filter: {
      must: [
        { key: "projectId", match: { value: projectId } },
        { key: "type", match: { value: "page_section" } }
      ]
    },
    with_payload: true,
    with_vector: true,
    limit: 10000
  });

  return (res.points ?? []).map((point) => ({
    ...point,
    vector: normalizeVector(point.vector)
  }));
}

export function naiveCluster(points: ProjectPoint[], maxClusterSize = 50): Cluster[] {
  const clusters: Cluster[] = [];
  let clusterIdx = 0;

  for (const p of points) {
    const url = p.payload?.url as string;
    let cluster = clusters.find((c) => c.id.startsWith(url));
    if (!cluster) {
      cluster = { id: `${url}#c${clusterIdx++}`, pointIds: [] };
      clusters.push(cluster);
    }
    cluster.pointIds.push(p.id);
  }

  return clusters;
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 1;
  return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function meanVector(vectors: number[][], dim: number): number[] {
  const centroid = new Array(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += vec[i];
    }
  }
  const count = vectors.length || 1;
  for (let i = 0; i < dim; i++) {
    centroid[i] /= count;
  }
  return centroid;
}

type KMeansOptions = {
  desiredClusterSize?: number;
  maxIterations?: number;
  maxClusters?: number;
};

export function kMeansCluster(
  points: ProjectPoint[],
  options: KMeansOptions = {}
): Cluster[] {
  const desiredClusterSize = options.desiredClusterSize ?? 20;
  const maxIterations = options.maxIterations ?? 30;
  const maxClusters = options.maxClusters ?? 12;

  const vectorPoints = points.filter(
    (p): p is ProjectPoint & { vector: number[] } => Array.isArray(p.vector) && p.vector.length > 0
  );
  const vectorPointIds = new Set(vectorPoints.map((p) => p.id));

  if (vectorPoints.length < 2) {
    return naiveCluster(points);
  }

  const dim = vectorPoints[0].vector!.length;
  let clusterCount = Math.max(
    1,
    Math.round(vectorPoints.length / desiredClusterSize)
  );
  clusterCount = Math.min(
    maxClusters,
    Math.max(1, Math.min(clusterCount, vectorPoints.length))
  );

  let centroids = vectorPoints.slice(0, clusterCount).map((p) => [...p.vector!]);
  let assignments = new Array(vectorPoints.length).fill(0);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let changed = false;
    for (let i = 0; i < vectorPoints.length; i++) {
      const vec = vectorPoints[i].vector!;
      let bestCluster = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let c = 0; c < centroids.length; c++) {
        const distance = cosineDistance(vec, centroids[c]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    const groupedVectors: number[][][] = Array.from({ length: centroids.length }, () => []);
    assignments.forEach((clusterIdx, pointIdx) => {
      groupedVectors[clusterIdx].push(vectorPoints[pointIdx].vector!);
    });

    const newCentroids = groupedVectors.map((group, idx) =>
      group.length ? meanVector(group, dim) : [...centroids[idx]]
    );

    centroids = newCentroids;

    if (!changed) {
      break;
    }
  }

  const buckets: Array<Array<string | number>> = Array.from(
    { length: centroids.length },
    () => []
  );
  const urlToCluster = new Map<string, number>();
  assignments.forEach((clusterIdx, pointIdx) => {
    const point = vectorPoints[pointIdx];
    buckets[clusterIdx].push(point.id);
    const url = point.payload?.url;
    if (typeof url === "string" && !urlToCluster.has(url)) {
      urlToCluster.set(url, clusterIdx);
    }
  });

  const nonVectorPoints = points.filter((p) => !vectorPointIds.has(p.id));
  for (const point of nonVectorPoints) {
    const url = point.payload?.url;
    let clusterIdx: number | undefined =
      typeof url === "string" ? urlToCluster.get(url) : undefined;
    if (clusterIdx === undefined) {
      clusterIdx = buckets.reduce(
        (bestIdx, ids, idx) =>
          ids.length < (buckets[bestIdx]?.length ?? Number.POSITIVE_INFINITY)
            ? idx
            : bestIdx,
        0
      );
    }
    buckets[clusterIdx].push(point.id);
  }

  return buckets
    .map((pointIds, idx) => ({
      id: `cluster-${idx + 1}`,
      pointIds,
      centroid: centroids[idx]
    }))
    .filter((cluster) => cluster.pointIds.length > 0);
}
