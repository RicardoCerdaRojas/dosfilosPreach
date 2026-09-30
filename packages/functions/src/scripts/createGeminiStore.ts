import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Initialize Firebase (assumes GOOGLE_APPLICATION_CREDENTIALS or default auth)
try {
    initializeApp();
} catch (e) {
    console.log('Firebase already initialized or failed, continuing...');
}

const db = getFirestore();
const storage = getStorage();

interface FileSearchStore {
    name: string;
}

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ Please set GEMINI_API_KEY environment variable');
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });

    console.log('🔍 Searching for documents...');

    // Find Grudem
    const grudemQuery = await db.collection('library_resources')
        .where('title', '>=', 'Grudem')
        .where('title', '<=', 'Grudem\uf8ff')
        .limit(1)
        .get();

    // Find another PDF
    const otherQuery = await db.collection('library_resources')
        .where('type', '==', 'counseling') // Try counseling category seen in screenshot
        .limit(1)
        .get();

    const resources = [...grudemQuery.docs, ...otherQuery.docs];

    if (resources.length === 0) {
        console.error('❌ No documents found');
        return;
    }

    console.log(`📚 Found ${resources.length} documents to process`);

    const uploadedFiles = [];

    for (const doc of resources) {
        const data = doc.data();
        console.log(`Processing: ${data.title}`);

        // Parse gs:// url
        // Format: gs://bucket-name/path/to/file
        const storageUrl = data.storageUrl;
        const tempFilePath = path.join(os.tmpdir(), `gemini_upload_${doc.id}.pdf`);

        console.log(`  ⬇️ Downloading to ${tempFilePath}...`);

        if (storageUrl.startsWith('gs://')) {
            const parts = storageUrl.replace('gs://', '').split('/');
            const bucketName = parts[0];
            const filePath = parts.slice(1).join('/');

            const bucket = storage.bucket(bucketName);
            const file = bucket.file(filePath);
            await file.download({ destination: tempFilePath });
        } else if (storageUrl.startsWith('http')) {
            // Download via fetch
            const response = await fetch(storageUrl);
            if (!response.ok) {
                console.error(`  ❌ Failed to download ${storageUrl}: ${response.statusText}`);
                continue;
            }
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(tempFilePath, Buffer.from(buffer));
        } else {
            console.log(`  ⚠️ Invalid storage URL: ${storageUrl}, skipping`);
            continue;
        }

        console.log(`  ⬆️ Uploading to Gemini...`);
        const subido = await ai.files.upload({
            file: tempFilePath,
            config: { mimeType: 'application/pdf', displayName: data.title },
        });

        console.log(`  ✅ Uploaded: ${subido.name}`);
        uploadedFiles.push(subido);

        // Cleanup temp
        fs.unlinkSync(tempFilePath);
    }

    // Create Store via REST API (without files first)
    console.log('📦 Creating File Search Store...');

    const createStoreResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            displayName: "DosFilos Library PoC"
        })
    });

    if (!createStoreResponse.ok) {
        throw new Error(`Failed to create store: ${createStoreResponse.statusText} ${await createStoreResponse.text()}`);
    }

    const store = await createStoreResponse.json() as FileSearchStore;
    console.log(`  ✅ Store Created: ${store.name}`);

    // Add files to store
    console.log('🔗 Adding files to store...');

    for (const file of uploadedFiles) {
        try {
            // Correct endpoint for adding files to a store:
            // POST https://generativelanguage.googleapis.com/v1beta/{storeName}/files?key=API_KEY
            // Body: { resourceName: "files/..." }

            const addFileResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${store.name}/files?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resourceName: file.name })
            });

            if (!addFileResponse.ok) {
                console.error(`  ❌ Failed to add ${file.name}: ${addFileResponse.status} ${addFileResponse.statusText}`);
                console.error(`     Details: ${await addFileResponse.text()}`);
            } else {
                console.log(`  ✅ Added ${file.name} to store`);
            }
        } catch (e) {
            console.error(`  ⚠️ Error adding file ${file.name}:`, e);
        }
    }

    console.log('\n🎉 DONE!');
    console.log('------------------------------------------------');
    console.log('GEMINI_STORE_NAME:', store.name);
    console.log('------------------------------------------------');
    console.log('Use this store name in your client configuration.');
}

run().catch(console.error);
