import fs from 'fs';

async function test(endpoint, payload) {
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer 042c71f3-903f-42e6-aac9-9b07f50efd5b"
        },
        body: JSON.stringify(payload)
    });
    return {
        endpoint,
        payload,
        status: res.status,
        body: await res.json().catch(async () => await res.text())
    };
}

async function run() {
    const epMulti = "https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal";
    
    const results = [];
    results.push(await test(epMulti, { 
        model: "ep-20260327215000-42pq9", 
        input: [{ type: "text", text: "test" }] 
    }));
    
    fs.writeFileSync('result.json', JSON.stringify(results, null, 2), 'utf8');
}

run().catch(console.error);
