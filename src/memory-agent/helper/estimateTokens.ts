export function estimateTokens(text:unknown):number{
    if(typeof text !== "string"){
        return 0;
    }
    const trimmed = text.trim();
    if(!trimmed){
        return 0;
    }
    const words = trimmed.split(/\s+/).length;
    // 1 word = 1.3 tokens
    return Math.ceil(words * 1.3);
}