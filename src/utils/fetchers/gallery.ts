import type { GalleryResponse } from "../../types/internal.raw.d.ts";
import type { Gallery } from "../../types/main.js";
import { gallerySchema } from "../../schemas.js";
import { parseIdentification, parseResources } from "../parse.js";

/**
 * Fetches and parses a gallery from the OCHRE API
 *
 * @param uuid - The UUID of the gallery
 * @param filter - The filter to apply to the gallery
 * @param page - The page number to fetch
 * @param perPage - The number of items per page
 * @returns The parsed gallery or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const gallery = await fetchGallery("9c4da06b-f15e-40af-a747-0933eaf3587e", "1978", 1, 12);
 * if (gallery === null) {
 *   console.error("Failed to fetch gallery");
 *   return;
 * }
 * console.log(`Fetched gallery: ${gallery.identification.label}`);
 * console.log(`Contains ${gallery.resources.length.toLocaleString()} resources`);
 * ```
 *
 * @remarks
 * The returned gallery includes:
 * - Gallery metadata and identification
 * - Project identification
 * - Resources (gallery items)
 */
export async function fetchGallery(
  uuid: string,
  filter: string,
  page: number,
  perPage: number,
  customFetch?: (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => Promise<Response>,
): Promise<
  { item: Gallery | null; error: null } | { item: null; error: string }
> {
  try {
    const {
      uuid: parsedUuid,
      filter: parsedFilter,
      page: parsedPage,
      perPage: parsedPerPage,
    } = gallerySchema.parse({ uuid, filter, page, perPage });

    const response = await (customFetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`
        for $q in input()/ochre[@uuid='${parsedUuid}']
        let $filtered := $q//items/resource[contains(lower-case(identification/label), lower-case('${parsedFilter}'))]
        let $maxLength := count($filtered)
        return <gallery maxLength='{$maxLength}'>
          {$q/metadata/project}
          {$q/metadata/item}
          {$filtered[position() >= ${((parsedPage - 1) * parsedPerPage + 1).toString()} and position() < ${(parsedPage * parsedPerPage + 1).toString()}]}
        </gallery>
      `)}&format=json`,
    );
    if (!response.ok) {
      throw new Error("Error fetching gallery items, please try again later.");
    }

    const data = (await response.json()) as GalleryResponse;

    if (!("gallery" in data.result)) {
      throw new Error("Failed to fetch gallery");
    }

    const galleryIdentification = parseIdentification(
      data.result.gallery.item.identification,
    );
    const galleryProjectIdentification = parseIdentification(
      data.result.gallery.project.identification,
    );

    const gallery = {
      identification: galleryIdentification,
      projectIdentification: galleryProjectIdentification,
      resources: parseResources(
        data.result.gallery.resource ?
          Array.isArray(data.result.gallery.resource) ?
            data.result.gallery.resource
          : [data.result.gallery.resource]
        : [],
      ),
      maxLength: data.result.gallery.maxLength,
    };

    return { item: gallery, error: null };
  } catch (error) {
    console.error(error);
    return {
      item: null,
      error: error instanceof Error ? error.message : "Failed to fetch gallery",
    };
  }
}
