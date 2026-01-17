import axios from "axios";
import path from "path";
import fs from "fs";

/**
 * Downloads an image from a URL and saves it to the local uploads directory.
 *
 * Streams the image data from the remote URL and writes it to the `uploads` folder
 * in the current working directory. The filename is extracted from the URL pathname.
 *
 * @param {string} imageUrl - The URL of the image to download
 * @returns {Promise<string>} The saved filename (without path)
 * @throws Will throw if the download or file write operation fails
 *
 * @example
 * const filename = await downloadImageToUploads('https://example.com/image.jpg');
 * // Returns: 'image.jpg'
 */
async function downloadImageToUploads(imageUrl: string): Promise<string> {
  const filename = path.basename(new URL(imageUrl).pathname);
  const filepath = path.join(process.cwd(), "uploads", filename);

  const response = await axios.get(imageUrl, { responseType: "stream" });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    (response.data as NodeJS.ReadableStream).pipe(writer);

    writer.on("finish", () => resolve(filename));
    writer.on("error", reject);
  });
}
