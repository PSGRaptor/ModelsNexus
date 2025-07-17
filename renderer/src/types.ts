// renderer/src/types.ts

// Metadata fields commonly found in Stable Diffusion and similar images
export interface IImageMeta {
    // General fields
    [key: string]: string | number | string[] | undefined;
    error?: string;                     // Error info if reading fails
    prompt?: string;                    // Positive prompt
    negative_prompt?: string;           // Negative prompt
    steps?: number;                     // Number of steps
    sampler?: string;                   // Sampler used
    cfg_scale?: number;                 // CFG scale
    seed?: number;                      // Random seed
    size?: string;                      // Image size (e.g. "512x512")
    model?: string;                     // Model name
    hash?: string;                      // Model hash
    clip_skip?: number;                 // CLIP skip
    denoising_strength?: number;        // Denoising strength
    hires_fix?: string | undefined;                // Hires fix used
    lora_weights?: string[];            // List of Lora weights used
    date?: string;                      // Creation date
    // ...add any additional fields from your workflow as needed
}

// Minimal model interface for database/model operations
export interface Model {
    id: number;
    file_name: string;
    model_name?: string;
    model_hash: string;
    file_path: string;
    model_type?: string;
    version?: string;
    base_model?: string;
    is_favorite?: number;
    preview_image_url?: string;
    images?: string[];
    tags?: string[];
    prompt_positive?: string;
    prompt_negative?: string;
    civitai_url?: string;
    huggingface_url?: string;
    cover_image?: string | null;
    // ...expand as needed for your app
}
