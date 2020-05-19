import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // Checkando se o customer é válido e o usuário existe
    const user = await this.customersRepository.findById(customer_id);

    // Se não existir, erro
    if (!user) throw new AppError('invalid customer id');

    // Pegando os ids de todos os produtos para checkar
    const productsIds = products.map(product => ({
      id: product.id,
    }));

    // Fazendo a checkagem
    const allProducts = await this.productsRepository.findAllById(productsIds);

    // Se o tamanho de produtos fornecido for menor que
    // o de produtos validados, algum produto era inválido, erro
    if (allProducts.length < productsIds.length)
      throw new AppError("Error, you can't buy a invalid product");

    const updatedQuantities: IProduct[] = [];

    // Precisamos ver se tem a quantidade suficiente para a compra,
    // e atualizar a quantidade
    const orderProducts = allProducts.map(product => {
      const idx = products.findIndex(self => product.id === self.id);

      if (products[idx].quantity > product.quantity) {
        throw new AppError(
          `Product: ${product.name}. Required: ${products[idx].quantity}. Available: ${product.quantity}`,
        );
      }

      updatedQuantities.push({
        id: product.id,
        quantity: product.quantity - products[idx].quantity,
      });

      return {
        ...product,
        quantity: products[idx].quantity,
      };
    });

    await this.productsRepository.updateQuantity(updatedQuantities);

    const order = await this.ordersRepository.create({
      customer: user,
      products: orderProducts.map(product => ({
        product_id: product.id,
        price: product.price,
        quantity: product.quantity,
      })),
    });

    return order;
  }
}

export default CreateProductService;
