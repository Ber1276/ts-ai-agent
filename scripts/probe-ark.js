async function test(endpoint, payload) {
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer 042c71f3-903f-42e6-aac9-9b07f50efd5b"
        },
        body: JSON.stringify(payload)
    });
    console.log("ENDPOINT:", endpoint);
    console.log("PAYLOAD:", JSON.stringify(payload));
    console.log("STATUS:", res.status);
    console.log("RESPONSE:", await res.text());
}

async function run() {
    const epNormal = "https://ark.cn-beijing.volces.com/api/v3/embeddings";
    const epMulti = "https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal";
    await test(epNormal, { model: "ep-20260327215000-42pq9", input: "test" });
    await test(epNormal, { model: "ep-20260327215000-42pq9", input: ["test"] });
    await test(epMulti, { model: "ep-20260327215000-42pq9", input: "test" });
    await test(epMulti, { model: "ep-20260327215000-42pq9", input: ["test"] });
}

run().catch(console.error);
