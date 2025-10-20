/**
 * Axios HTTP Client Implementation
 * Concrete implementation of IHttpClient using Axios
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import {
  IHttpClient,
  HttpRequestConfig,
  HttpResponse,
} from "../../core/interfaces/IHttpClient.js";
import { ILogger } from "../../core/interfaces/ILogger.js";
import { LoggerFactory } from "../logging/LoggerFactory.js";

export class AxiosHttpClient implements IHttpClient {
  private axiosInstance: AxiosInstance;
  private logger: ILogger;

  constructor(defaultTimeout: number = 30000, logger?: ILogger) {
    this.logger = logger || LoggerFactory.getLogger("AxiosHttpClient");
    this.axiosInstance = axios.create({
      timeout: defaultTimeout,
      validateStatus: () => true, // Don't throw on any status code
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(
          `HTTP Request: ${config.method?.toUpperCase()} ${config.url}`,
          {
            params: config.params,
            hasData: !!config.data,
          }
        );
        return config;
      },
      (error) => {
        this.logger.error(`HTTP Request Error`, error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `HTTP Response: ${response.status} from ${response.config.url}`
        );
        return response;
      },
      (error) => {
        if (error.code === "ECONNABORTED") {
          this.logger.warning(`HTTP Request Timeout: ${error.config?.url}`);
        } else {
          this.logger.error(`HTTP Response Error`, error);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Convert Axios response to our HttpResponse interface
   */
  private mapResponse<T>(axiosResponse: AxiosResponse<T>): HttpResponse<T> {
    return {
      data: axiosResponse.data,
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: axiosResponse.headers as Record<string, string>,
    };
  }

  async request<T = any>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    try {
      const response = await this.axiosInstance.request<T>({
        url: config.url,
        method: config.method,
        params: config.params,
        data: config.data,
        headers: config.headers,
        timeout: config.timeout,
      });
      return this.mapResponse(response);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          // Server responded with error status
          return this.mapResponse(axiosError.response as AxiosResponse<T>);
        }
      }
      // Network error or timeout
      throw error;
    }
  }

  async get<T = any>(
    url: string,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      url,
      method: "GET",
      ...config,
    });
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      url,
      method: "POST",
      data,
      ...config,
    });
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      url,
      method: "PUT",
      data,
      ...config,
    });
  }

  async delete<T = any>(
    url: string,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      url,
      method: "DELETE",
      ...config,
    });
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: Partial<HttpRequestConfig>
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      url,
      method: "PATCH",
      data,
      ...config,
    });
  }
}
