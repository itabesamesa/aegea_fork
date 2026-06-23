import {parse} from "node-html-parser";

const HOST = "https://safebooru.org"
const PATH = "/index.php"

// Indexing starts at 0
async function getTotalPosts(tags: string) {
    const url = new URL(HOST);
    url.pathname = PATH;
    url.searchParams.set("page", "post");
    url.searchParams.set("s", "list");
    url.searchParams.set("tags", tags);
    
    const page = await fetch(url);
    const document = parse(await page.text());
    const lastPageAnchor = document.querySelector("a[alt='last page']") as HTMLAnchorElement | null;
    const lastPageSearchParams = lastPageAnchor?.getAttribute("href");

    if (!lastPageSearchParams) {
        throw Error(`Could not find last page button on page ${url}`);
    }

    const lastPageUrl = new URL(`${HOST}${PATH}${lastPageSearchParams}`);
    const lastPagePid = lastPageUrl.searchParams.get("pid");
    if (!lastPagePid) {
        throw Error(`Could not find pid search param for page ${lastPageUrl}`);
    }

    const lastPage = await fetch(lastPageUrl); // actually just params
    const lastPageDocument = parse(await lastPage.text());
    const images = lastPageDocument.querySelectorAll("#content .thumb");

    return parseInt(lastPagePid) + images.length;
}

async function getPostIdByTagsAndPid(tags: string, pid: number) {
    const url = new URL(HOST);
    url.pathname = PATH;
    url.searchParams.set("page", "post");
    url.searchParams.set("s", "list");
    url.searchParams.set("tags", tags);
    url.searchParams.set("pid", pid.toString());

    const page = await fetch(url);
    const document = parse(await page.text());
    const firstImageAnchor = document.querySelector("div.content a") as HTMLAnchorElement | null;
    const href = firstImageAnchor?.getAttribute("href");

    if (!href) {
        throw Error(`Could not find first image href for page ${url}`);
    }

    const imageUrl = new URL(`${HOST}${href}`);
    const id = imageUrl.searchParams.get("id");
    return id;
}

export async function getRandomPost(tags: string) {
    const url = new URL(HOST);
    url.pathname = PATH;
    url.searchParams.set("page", "post");
    url.searchParams.set("s", "list");
    url.searchParams.set("tags", tags);

    const totalPosts = await getTotalPosts(tags);
    const randomPid = Math.floor(Math.random() * totalPosts);
    const id = await getPostIdByTagsAndPid(tags, randomPid);

    if (!id) {
        return null;
    }

    const post = getPost(id);
    return post;
}

export async function getPost(id: string) {
    const url = new URL(HOST);
    url.pathname = PATH;
    url.searchParams.set("page", "post");
    url.searchParams.set("s", "view");
    url.searchParams.set("id", id);

    const page = await fetch(url);
    const document = parse(await page.text());

    const originalImageA = document.querySelector("a[style='font-weight: bold;']") as HTMLAnchorElement | null;
    const href = originalImageA?.getAttribute("href");
    return href;
}
