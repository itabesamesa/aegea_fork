import { parse } from "node-html-parser";
import { Post, SafebooruApiPost } from "./types";

const MAX_POSTS_PER_PAGE = 1000;
const MAX_ITERATIONS = 1000;

const HOST = "https://safebooru.org";
const PATH = "/index.php";

async function fetchTotalPosts(tags: string) {
    const url = new URL(HOST);
    url.pathname = PATH;
    url.searchParams.set("page", "dapi");
    url.searchParams.set("s", "post");
    url.searchParams.set("limit", "0");
    url.searchParams.set("q", "index");
    url.searchParams.set("tags", tags);

    const page = await fetch(url);
    const text = await page.text();
    const xml = parse(text);
    const postsTag = xml.querySelector("posts");
    const total = postsTag?.getAttribute("count");

    if (!total) {
        throw Error(`Couldn't get posts count from ${url}`);
    }

    return parseInt(total);
}

export async function fetchRandomPost(tags: string, alreadySentIds: Set<number>) {
    const totalPosts = await fetchTotalPosts(tags);
    if (totalPosts === 0) {
        throw Error(`No posts were found for tags \`${tags}\``);
    }

    const validIndices: Set<number> = new Set();
    for (let i = 0; i < totalPosts; i++) { validIndices.add(i); }

    let iterations = 0;
    while (iterations < MAX_ITERATIONS) {
        iterations++;

        const randomIndex = Math.floor(Math.random() * validIndices.size);
        const pageIndex = Math.floor(randomIndex / MAX_POSTS_PER_PAGE);
        const offset = pageIndex * MAX_POSTS_PER_PAGE;
        const range = await fetchRange(tags, pageIndex);
        const wantedPost = range.at(randomIndex-offset)!;
        if (alreadySentIds.has(wantedPost.postId)) {
            const duplicateIndices = getDuplicateIndices(range, alreadySentIds);
            duplicateIndices.forEach((i) => validIndices.delete(offset + i));
            if (validIndices.size == 0) {
                return null;
            }
        } else {
            return wantedPost;
        }
    }

    throw Error("Something probably went wrong.");
}

async function fetchRange(tags: string, pageId: number): Promise<Post[]> {
    const url = new URL(HOST);
    url.pathname = PATH;
    url.searchParams.set("page", "dapi");
    url.searchParams.set("s", "post");
    url.searchParams.set("json", "1");
    url.searchParams.set("q", "index");
    url.searchParams.set("limit", MAX_POSTS_PER_PAGE.toString());
    url.searchParams.set("tags", tags);
    url.searchParams.set("pid", pageId.toString());

    const page = await fetch(url);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json: SafebooruApiPost[] = await page.json();
    return json.map((o) => {return {
        fileUrl: o.file_url,
        postUrl: `${HOST}${PATH}?page=post&s=view&id=${o.id}`,
        source: o.source,
        postId: o.id
    };});
}

function getDuplicateIndices(range: Post[], alreadySentIds: Set<number>) {
    const duplicateIndices: number[] = [];
    for (let i = 0; i < range.length; i++) {
        const post = range[i];
        if (alreadySentIds.has(post.postId)) {
            duplicateIndices.push(i);
        }
    }
    return duplicateIndices;
}
