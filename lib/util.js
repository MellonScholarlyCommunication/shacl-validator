export function getArticle(word) {
    // Gemini generated
    if (!word || typeof word !== 'string') {
        return 'a'; // Default to 'a' if input is invalid
    }

    // 1. Sanitize the word: Get the first non-space word and convert to lowercase
    const normalizedWord = word.trim().split(/\s+/)[0].toLowerCase();

    if (normalizedWord.length === 0) {
        return 'a';
    }

    // --- Exceptions to the Standard Vowel/Consonant Rule ---

    // 2. Exception: Words starting with a pronounced 'h' (consonant sound)
    // Examples: 'house', 'hotel', 'historical', 'happy'
    // This is handled by the main vowel check, but some exceptions are for words like 'heir' (vowel sound)

    // 3. Exception: Words starting with 'u' or 'eu' that sound like 'you' (consonant sound)
    // Examples: 'university', 'unanimous', 'utopia', 'European', 'unicorn'
    // Regex: starts with 'u' followed by a consonant (like 'uni') OR starts with 'eu'
    if (/(^uni|unif|unun|euni|eub).*/.test(normalizedWord)) {
        return 'a';
    }

    // 4. Exception: Words starting with 'o' that sound like 'w' (consonant sound)
    // Examples: 'one-time offer', 'one-dollar bill'
    if (/^one.*/.test(normalizedWord)) {
        return 'a';
    }

    // --- Acronym/Initialism Check (based on pronunciation of the first letter) ---

    // 5. Acronym/Initialism Check: Check if the word is an initialism (like FBI, X-ray)
    // that starts with a letter pronounced with an initial vowel sound (A, E, F, H, I, L, M, N, O, R, S, X)
    const initialismRegex = /^(a|e|f|h|i|l|m|n|o|r|s|x)[a-z]*$/i;
    if (normalizedWord.length <= 4 && initialismRegex.test(normalizedWord)) {
        return 'an';
    }
    
    // --- Standard Vowel/Consonant Check ---

    // 6. Standard Check: If the first letter is a standard vowel sound (A, E, I, O, U)
    // Note: The 'h' exception is handled by checking for silent 'h' in step 5's acronym check, 
    // and the pronounced 'h' is handled by the initial standard check.
    const firstLetter = normalizedWord[0];
    const vowels = ['a', 'e', 'i', 'o', 'u'];

    if (vowels.includes(firstLetter)) {
        return 'an';
    }

    // 7. Default: If none of the 'an' conditions are met, use 'a'.
    return 'a';
}

export function truncateNS(str) {
  return str.replaceAll(/http\S+[#\/]/g,'')
            .replaceAll(/<(\w+)>/g,"*$1*")
            .replaceAll(/ 1 values/g," 1 value");
}

export function rephrase(str) {
  return str.replaceAll(/^value/g,"a value that");
}
