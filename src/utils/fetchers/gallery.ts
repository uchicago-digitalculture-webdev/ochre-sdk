import type { GalleryResponse } from "../../types/internal.raw.d.ts";
import type { ApiVersion, Gallery } from "../../types/main.js";
import { gallerySchema } from "../../schemas.js";
import { parseIdentification, parseResources } from "../parse/index.js";

/**
 * Fetches and parses a gallery from the OCHRE API
 *
 * @param uuid - The UUID of the gallery
 * @param filter - The filter to apply to the gallery
 * @param page - The page number to fetch
 * @param pageSize - The number of items per page
 * @param options - The options for the fetch
 * @param options.fetch - The fetch function to use
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed gallery or an error message if the fetch/parse fails
 */
export async function fetchGallery(
  uuid: string,
  filter: string,
  page: number,
  pageSize: number,
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version?: ApiVersion;
  },
): Promise<
  { item: Gallery | null; error: null } | { item: null; error: string }
> {
  try {
    const {
      uuid: parsedUuid,
      filter: parsedFilter,
      page: parsedPage,
      pageSize: parsedPageSize,
    } = gallerySchema.parse({ uuid, filter, page, pageSize });

    const response = await (options?.fetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`
        for $q in input()/ochre[@uuid='${parsedUuid}']
        let $filtered := $q//items/resource[contains(lower-case(identification/label), lower-case('${parsedFilter}'))]
        let $maxLength := count($filtered)
        return <gallery maxLength='{$maxLength}'>
          {$q/metadata/project}
          {$q/metadata/item}
          {$filtered[position() >= ${((parsedPage - 1) * parsedPageSize + 1).toString()} and position() < ${(parsedPage * parsedPageSize + 1).toString()}]}
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
