import axios from 'axios';

export const cleanUrl = (url: string): string => {
  const decoded = decodeURIComponent(url);
  // Ensure that if a caller prepended '/' to a data or remote URL, we strip it out cleanly
  if (decoded.startsWith('/data:')) {
    return decoded.substring(1);
  }
  if (decoded.startsWith('/http:') || decoded.startsWith('/https:')) {
    return decoded.substring(1);
  }
  if (decoded.startsWith('/blob:')) {
    return decoded.substring(1);
  }
  return decoded;
};

export const viewFile = async (url: string) => {
  try {
    const cleanedUrl = cleanUrl(url);
    if (cleanedUrl.startsWith('data:')) {
      const parts = cleanedUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      return;
    }

    if (cleanedUrl.startsWith('http://') || cleanedUrl.startsWith('https://')) {
      window.open(cleanedUrl, '_blank');
      return;
    }

    const finalPath = cleanedUrl.startsWith('/') ? cleanedUrl : `/${cleanedUrl}`;
    const token = localStorage.getItem("token");
    const response = await axios.get(finalPath, { 
      responseType: 'blob',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }));
    window.open(blobUrl, '_blank');
  } catch (error) {
    console.error("View failed:", error);
  }
};

export const downloadFile = async (url: string, defaultFilename: string) => {
  try {
    const cleanedUrl = cleanUrl(url);
    if (cleanedUrl.startsWith('data:')) {
      const parts = cleanedUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', defaultFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      return;
    }

    if (cleanedUrl.startsWith('http://') || cleanedUrl.startsWith('https://')) {
      try {
        // Fetch as a blob, without the app server's Authorization header to avoid CORS preflight failures on public storage servers
        const response = await axios.get(cleanedUrl, { 
          responseType: 'blob' 
        });
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', defaultFilename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        return;
      } catch (fetchErr) {
        console.warn("Direct blob download of cross-origin URL failed, falling back to target blank navigation:", fetchErr);
        const link = document.createElement('a');
        link.href = cleanedUrl;
        link.target = '_blank';
        link.setAttribute('download', defaultFilename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
    }

    const finalPath = cleanedUrl.startsWith('/') ? cleanedUrl : `/${cleanedUrl}`;
    const token = localStorage.getItem("token");
    const response = await axios.get(finalPath, { 
      responseType: 'blob',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    // Try to extract filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = defaultFilename;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Download failed:", error);
  }
};
