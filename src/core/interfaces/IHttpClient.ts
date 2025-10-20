/**
 * HTTP Client Interface
 * Abstraction for making HTTP requests
 */

export interface HttpRequestConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  params?: Record<string, any>;
  data?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface IHttpClient {
  /**
   * Execute an HTTP request
   */
  request<T = any>(config: HttpRequestConfig): Promise<HttpResponse<T>>;

  /**
   * Execute a GET request
   */
  get<T = any>(
    url: string,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>>;

  /**
   * Execute a POST request
   */
  post<T = any>(
    url: string,
    data?: any,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>>;

  /**
   * Execute a PUT request
   */
  put<T = any>(
    url: string,
    data?: any,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>>;

  /**
   * Execute a DELETE request
   */
  delete<T = any>(
    url: string,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>>;

  /**
   * Execute a PATCH request
   */
  patch<T = any>(
    url: string,
    data?: any,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>>;
}
