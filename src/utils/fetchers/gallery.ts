import * as z from "zod";
import type {
  OchreIdentification,
  OchreResource,
} from "../../types/internal.raw.d.ts";
import type { ApiVersion, Gallery } from "../../types/main.js";
import { uuidSchema } from "../../schemas.js";
import { DEFAULT_API_VERSION } from "../helpers.js";
import { parseIdentification, parseResources } from "../parse/index.js";

/**
 * Schema for validating gallery parameters
 */
const galleryParamsSchema = z.object({
  uuid: uuidSchema,
  filter: z.string().optional(),
  page: z.number().positive({ error: "Page must be positive" }),
  pageSize: z.number().positive({ error: "Page size must be positive" }),
});

/**
 * Fetches and parses a gallery from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.uuid - The UUID of the gallery
 * @param params.filter - The filter to apply to the gallery
 * @param params.page - The page number to fetch
 * @param params.pageSize - The number of items per page
 * @param options - The options for the fetch
 * @param options.fetch - The fetch function to use
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed gallery or an error message if the fetch/parse fails
 */
export async function fetchGallery(
  params: { uuid: string; filter?: string; page: number; pageSize: number },
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version?: ApiVersion;
  },
): Promise<
  { gallery: Gallery | null; error: null } | { gallery: null; error: string }
> {
  try {
    const version = options?.version ?? DEFAULT_API_VERSION;

    const { uuid, filter, page, pageSize } = galleryParamsSchema.parse(params);

    const response = await (options?.fetch ?? fetch)(
      `${version === 2 ? "https://ochre.lib.uchicago.edu/ochre/v2/ochre.php" : "https://ochre.lib.uchicago.edu/ochre"}?xquery=${encodeURIComponent(`<ochre>{
        for $q in ${version === 2 ? "doc()" : "input()"}/ochre[@uuid='${uuid}']
        let $filtered := $q//items/resource[contains(lower-case(identification/label), lower-case('${filter}'))]
        let $maxLength := count($filtered)
        return <gallery maxLength='{$maxLength}'>
          {$q/metadata/project}
          {$q/metadata/item}
          {$filtered[position() >= ${((page - 1) * pageSize + 1).toString()} and position() < ${(page * pageSize + 1).toString()}]}
        </gallery>
      }</ochre>`)}&format=json`,
    );
    if (!response.ok) {
      throw new Error("Error fetching gallery items, please try again later.");
    }

    const data = (await response.json()) as {
      result: {
        ochre:
          | {
              gallery: {
                project: { identification: OchreIdentification };
                item: { identification: OchreIdentification };
                resource?: OchreResource | Array<OchreResource>;
                maxLength: number;
              };
            }
          | [];
      };
    };

    if (!("gallery" in data.result.ochre)) {
      throw new Error("Failed to fetch gallery");
    }

    const galleryIdentification = parseIdentification(
      data.result.ochre.gallery.item.identification,
    );
    const galleryProjectIdentification = parseIdentification(
      data.result.ochre.gallery.project.identification,
    );

    const gallery = {
      identification: galleryIdentification,
      projectIdentification: galleryProjectIdentification,
      resources:
        data.result.ochre.gallery.resource ?
          parseResources(
            Array.isArray(data.result.ochre.gallery.resource) ?
              data.result.ochre.gallery.resource
            : [data.result.ochre.gallery.resource],
          )
        : [],
      maxLength: data.result.ochre.gallery.maxLength,
    };

    return { gallery, error: null };
  } catch (error) {
    console.error(error);
    return {
      gallery: null,
      error: error instanceof Error ? error.message : "Failed to fetch gallery",
    };
  }
}
