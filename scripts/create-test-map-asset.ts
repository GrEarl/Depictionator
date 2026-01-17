import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  // Get first workspace
  const workspace = await prisma.workspace.findFirst({
    where: { slug: 'default' }
  });

  if (!workspace) {
    console.error('No default workspace found');
    process.exit(1);
  }

  console.log('Workspace:', workspace.id, workspace.name);

  // Get first user
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found');
    process.exit(1);
  }

  console.log('User:', user.id, user.email);

  // Create simple SVG map image
  const svgContent = `<svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="1000" fill="#87CEEB"/>
  <circle cx="500" cy="500" r="200" fill="#4169E1"/>
  <text x="500" y="520" font-size="60" text-anchor="middle" fill="white" font-family="Arial">Test World Map</text>
  <circle cx="300" cy="300" r="20" fill="red"/>
  <text x="300" y="280" font-size="20" text-anchor="middle" fill="black">Point A</text>
  <circle cx="700" cy="600" r="20" fill="green"/>
  <text x="700" y="580" font-size="20" text-anchor="middle" fill="black">Point B</text>
</svg>`;

  // Save to storage
  const storageDir = path.join(process.cwd(), 'storage', workspace.id);
  await mkdir(storageDir, { recursive: true });
  const storageKey = `test-world-map-${Date.now()}.svg`;
  const filePath = path.join(storageDir, storageKey);
  await writeFile(filePath, svgContent);

  console.log('Created file:', filePath);

  // Create asset in database
  const asset = await prisma.asset.create({
    data: {
      workspaceId: workspace.id,
      kind: 'image',
      storageKey,
      mimeType: 'image/svg+xml',
      size: Buffer.byteLength(svgContent),
      createdById: user.id,
      author: 'System',
      attributionText: 'Test map created by system'
    }
  });

  console.log('Created asset:', asset.id);

  // Update map with this asset
  const map = await prisma.map.findFirst({
    where: { workspaceId: workspace.id }
  });

  if (map) {
    await prisma.map.update({
      where: { id: map.id },
      data: { imageAssetId: asset.id }
    });
    console.log('Updated map:', map.id, 'with asset:', asset.id);
  } else {
    console.log('No map found to update');
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
